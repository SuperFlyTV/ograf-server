import * as React from 'react'
import { useState } from 'react'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Stack from '@mui/material/Stack'
import { getServerUrl } from '../lib/lib.js'

export const RegisterForm: React.FC<{
	setNamespaceId: (namespaceId: string) => void
}> = ({ setNamespaceId }) => {
	const [email, setEmail] = useState('')

	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setLoading(true)

		Promise.resolve()
			.then(async () => {
				try {
					const response = await fetch(`${getServerUrl()}/serverApi/register`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ email }),
					})

					if (!response.ok) {
						throw new Error(`HTTP error! status: ${response.status}`)
					}

					const data = await response.json()
					setNamespaceId(data.namespaceId)

					setEmail('')
				} catch (err) {
					setError(err instanceof Error ? err.message : 'An error occurred')
				} finally {
					setLoading(false)
				}
			})
			.catch(console.error)
	}

	return (
		<>
			<Typography variant="h4" component="h2" sx={{ mt: 3, mb: 2 }}>
				Getting started
			</Typography>
			<Typography variant="body1" sx={{ mb: 2 }}>
				To get started, please enter your email address to create a new namespace that's just for you.
				<br />
			</Typography>

			<Stack spacing={2} sx={{ maxWidth: 400, mx: 'auto' }}>
				{error && <Alert severity="error">{error}</Alert>}
				<form onSubmit={handleSubmit}>
					<Stack spacing={2}>
						<TextField
							type="email"
							label="Email Address"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							fullWidth
							disabled={loading}
							placeholder="your@email.com"
						/>
						<Button type="submit" variant="contained" color="primary" disabled={loading || !email} sx={{ py: 1 }}>
							{loading ? <CircularProgress size={24} /> : 'Register'}
						</Button>
					</Stack>
				</form>
			</Stack>
		</>
	)
}
