import * as JsSIP from 'jssip'
import { OgrafApi } from './ografApi.js'
import { appSettingsStore } from '../stores/appSettings.js'

export interface ElksVoiceNumberInfo {
	id: string
	number: string
	name: string
	country: string
	voice_start: string
}

export interface ElksSetupResult {
	webrtcNumber: {
		id: string
		number: string
		secret: string
	} | null
	selectedVoiceNumber: {
		id: string
		number: string
		name: string
		voice_start: string
	} | null
	voiceNumbers: ElksVoiceNumberInfo[]
}

export type ElksCallStatus = 'idle' | 'registering' | 'waiting' | 'in_call' | 'error'

export async function fetchAndSetupElksNumbers(options?: { configureRouting?: boolean }): Promise<ElksSetupResult> {
	const apiUsername = appSettingsStore.elksApiUsername.trim()
	const apiPassword = appSettingsStore.elksApiPassword.trim()

	if (!apiUsername || !apiPassword) {
		return {
			webrtcNumber:
				appSettingsStore.elksWebrtcNumber.trim() && appSettingsStore.elksWebrtcSecret.trim()
					? {
							id: 'manual',
							number: appSettingsStore.elksWebrtcNumber.trim(),
							secret: appSettingsStore.elksWebrtcSecret.trim(),
						}
					: null,
			selectedVoiceNumber: appSettingsStore.elksSelectedPhoneNumber.trim()
				? {
						id: 'manual',
						number: appSettingsStore.elksSelectedPhoneNumber.trim(),
						name: '',
						voice_start: '',
					}
				: null,
			voiceNumbers: [],
		}
	}

	const ografApi = OgrafApi.getSingleton()
	let baseUrl = ografApi.baseURL.replace('/ograf/v1', '')
	if (!baseUrl.endsWith('/')) baseUrl += '/'

	const response = await fetch(`${baseUrl}serverApi/internal/elks/setup`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			apiUsername,
			apiPassword,
			selectedPhoneNumber: appSettingsStore.elksSelectedPhoneNumber.trim() || undefined,
			configureRouting: options?.configureRouting ?? true,
		}),
	})

	if (!response.ok) {
		let errMsg = response.statusText
		try {
			const errJson = (await response.json()) as { error?: string; message?: string }
			errMsg = errJson.error || errJson.message || errMsg
		} catch {
			const text = await response.text().catch(() => '')
			if (text) errMsg = text
		}
		throw new Error(errMsg || `46elks setup failed (${response.status})`)
	}

	const result = (await response.json()) as ElksSetupResult
	if (result.webrtcNumber?.number) {
		appSettingsStore.elksWebrtcNumber = result.webrtcNumber.number
	}
	if (result.webrtcNumber?.secret) {
		appSettingsStore.elksWebrtcSecret = result.webrtcNumber.secret
	}
	if (result.selectedVoiceNumber?.number) {
		appSettingsStore.elksSelectedPhoneNumber = result.selectedVoiceNumber.number
	}

	return result
}

export interface ElksWebrtcSessionCallbacks {
	onStatusChange: (status: ElksCallStatus, detail?: string) => void
	onCallerChange: (callerNumber: string | null) => void
}

export class ElksWebrtcPhoneSession {
	private ua: JsSIP.UA | null = null
	private currentSession: any = null
	private remoteSourceNode: MediaStreamAudioSourceNode | null = null
	private remoteAudioElement: HTMLAudioElement | null = null
	private silentAnswerDest: MediaStreamAudioDestinationNode | null = null
	private isStopped = false

	constructor(
		private readonly audioContext: AudioContext,
		private readonly targetGainNode: GainNode,
		private readonly webrtcNumber: string,
		private readonly webrtcSecret: string,
		private readonly callbacks: ElksWebrtcSessionCallbacks
	) {}

	public start(): void {
		this.isStopped = false
		const cleanUser = this.webrtcNumber.trim().replace(/^\+/, '')
		const secret = this.webrtcSecret.trim()

		if (!cleanUser || !secret) {
			this.callbacks.onStatusChange(
				'error',
				'Missing 46elks WebRTC number or secret. Ensure your 46elks account has a WebRTC number enabled.'
			)
			return
		}

		this.callbacks.onStatusChange('registering')

		const socket = new JsSIP.WebSocketInterface('wss://voip.46elks.com/w1/websocket')
		const ua = new JsSIP.UA({
			sockets: [socket],
			uri: `sip:${cleanUser}@voip.46elks.com`,
			password: secret,
			register: true,
		})
		this.ua = ua

		ua.on('registered', () => {
			if (this.isStopped) return
			this.callbacks.onStatusChange('waiting')
		})

		ua.on('registrationFailed', (e: any) => {
			if (this.isStopped) return
			const cause = e?.cause || 'Registration failed'
			this.callbacks.onStatusChange('error', `46elks SIP registration failed: ${cause}`)
		})

		ua.on('disconnected', () => {
			if (this.isStopped) return
			this.callbacks.onCallerChange(null)
		})

		ua.on('newRTCSession', (data: any) => {
			if (this.isStopped) return
			const session = data.session
			if (!session) return

			if (this.currentSession && this.currentSession !== session) {
				try {
					this.currentSession.terminate()
				} catch {
					// ignore
				}
			}
			this.currentSession = session

			const callerUser =
				session.remote_identity?.uri?.user || session.remote_identity?.display_name || 'Incoming caller'

			const attachRemoteTrack = (stream: MediaStream) => {
				if (this.isStopped) return
				this.detachRemoteAudio()

				try {
					// Attach to a muted HTMLAudioElement so Chromium actively pulls RTP packets on the WebRTC track
					const audioEl = document.createElement('audio')
					audioEl.muted = true
					audioEl.autoplay = true
					audioEl.srcObject = stream
					void audioEl.play().catch(() => {})
					this.remoteAudioElement = audioEl

					const sourceNode = this.audioContext.createMediaStreamSource(stream)
					sourceNode.connect(this.targetGainNode)
					this.remoteSourceNode = sourceNode
				} catch (err) {
					console.error('Failed to route 46elks remote call audio into WebAudio mixer:', err)
				}
			}

			session.on('peerconnection', (e: any) => {
				const pc: RTCPeerConnection | undefined = e?.peerconnection
				if (!pc) return
				pc.addEventListener('track', (trackEvent: RTCTrackEvent) => {
					const remoteStream =
						trackEvent.streams && trackEvent.streams[0] ? trackEvent.streams[0] : new MediaStream([trackEvent.track])
					attachRemoteTrack(remoteStream)
				})
			})

			session.on('confirmed', () => {
				if (this.isStopped) return
				this.callbacks.onCallerChange(callerUser)
				this.callbacks.onStatusChange('in_call')

				// Fallback if ontrack fired before confirmed or via getReceivers
				const pc: RTCPeerConnection | undefined = session.connection
				if (pc && !this.remoteSourceNode) {
					const remoteTracks = pc
						.getReceivers()
						.map((r) => r.track)
						.filter((t): t is MediaStreamTrack => Boolean(t && t.kind === 'audio'))
					if (remoteTracks.length > 0) {
						attachRemoteTrack(new MediaStream(remoteTracks))
					}
				}
			})

			const handleCallEnded = () => {
				if (this.currentSession === session) {
					this.currentSession = null
				}
				this.detachRemoteAudio()
				if (!this.isStopped) {
					this.callbacks.onCallerChange(null)
					this.callbacks.onStatusChange('waiting')
				}
			}

			session.on('ended', handleCallEnded)
			session.on('failed', handleCallEnded)

			if (session.direction === 'incoming') {
				try {
					if (!this.silentAnswerDest) {
						this.silentAnswerDest = this.audioContext.createMediaStreamDestination()
					}
					session.answer({
						mediaStream: this.silentAnswerDest.stream,
						mediaConstraints: { audio: true, video: false },
					})
					this.callbacks.onCallerChange(callerUser)
					this.callbacks.onStatusChange('in_call')
				} catch (ansErr) {
					console.error('Failed to auto-answer incoming 46elks call:', ansErr)
				}
			}
		})

		ua.start()
	}

	private detachRemoteAudio(): void {
		if (this.remoteSourceNode) {
			try {
				this.remoteSourceNode.disconnect()
			} catch {
				// ignore
			}
			this.remoteSourceNode = null
		}
		if (this.remoteAudioElement) {
			try {
				this.remoteAudioElement.pause()
				this.remoteAudioElement.srcObject = null
			} catch {
				// ignore
			}
			this.remoteAudioElement = null
		}
	}

	public stop(): void {
		this.isStopped = true
		this.detachRemoteAudio()
		if (this.currentSession) {
			try {
				this.currentSession.terminate()
			} catch {
				// ignore
			}
			this.currentSession = null
		}
		if (this.ua) {
			try {
				this.ua.stop()
			} catch {
				// ignore
			}
			this.ua = null
		}
		this.silentAnswerDest = null
	}
}
