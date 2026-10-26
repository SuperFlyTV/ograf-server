import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'

export const DataPreview: React.FC<{ data: unknown }> = ({ data }) => {
	if (data === undefined || data === null) {
		return null
	}

	if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
		const strValue = `${data}`
		if (!strValue.trim()) return null

		return (
			<Tooltip title={strValue}>
				<Box
					sx={{
						mt: 0.25,
						px: 0.75,
						py: 0.1,
						bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
						borderRadius: 1,
						border: '1px solid',
						borderColor: 'divider',
						display: 'inline-flex',
						alignItems: 'center',
						maxWidth: '100%',
					}}
				>
					<Typography variant="caption" fontWeight={600} noWrap sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
						{strValue}
					</Typography>
				</Box>
			</Tooltip>
		)
	}

	if (Array.isArray(data)) {
		if (data.length === 0) {
			return null
		}

		const displayItems = data.slice(0, 4)
		const remaining = data.length - displayItems.length

		return (
			<Box sx={{ mt: 0.25 }}>
				<Stack direction="row" spacing={0.5} flexWrap="nowrap" overflow="hidden" alignItems="center">
					{displayItems.map((val, idx) => (
						<Chip
							key={idx}
							label={
								typeof val === 'object' && val !== null
									? JSON.stringify(val)
									: `${(val as string | number | boolean) ?? ''}`
							}
							size="small"
							variant="outlined"
							sx={{ height: 18, fontSize: '0.68rem', px: 0.25 }}
						/>
					))}
					{remaining > 0 && (
						<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem', flexShrink: 0 }}>
							+{remaining} more
						</Typography>
					)}
				</Stack>
			</Box>
		)
	}

	const obj = data as Record<string, unknown>
	const keys = Object.keys(obj)
	if (keys.length === 0) {
		return null
	}

	const displayKeys = keys.slice(0, 5)
	const remainingCount = keys.length - displayKeys.length
	const fullJsonStr = JSON.stringify(data, null, 2)

	return (
		<Tooltip title={<pre style={{ margin: 0, fontSize: '0.75rem' }}>{fullJsonStr}</pre>}>
			<Box
				sx={{
					mt: 0.25,
					px: 0.75,
					py: 0.25,
					bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
					borderRadius: 1,
					border: '1px solid',
					borderColor: 'divider',
					display: 'inline-block',
					maxWidth: '100%',
					overflow: 'hidden',
				}}
			>
				<Stack direction="row" spacing={0.75} flexWrap="nowrap" alignItems="center" sx={{ overflow: 'hidden' }}>
					{displayKeys.map((key) => {
						const val = obj[key]
						const formattedVal =
							typeof val === 'object' && val !== null
								? JSON.stringify(val)
								: `${(val as string | number | boolean | undefined) ?? ''}`

						return (
							<Box
								key={key}
								sx={{
									display: 'inline-flex',
									alignItems: 'center',
									gap: 0.35,
									fontSize: '0.68rem',
									lineHeight: 1.1,
									flexShrink: 0,
								}}
							>
								<Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ fontSize: '0.68rem' }}>
									{key}:
								</Typography>
								<Typography
									variant="caption"
									fontWeight={700}
									color="text.primary"
									sx={{
										maxWidth: 110,
										overflow: 'hidden',
										textOverflow: 'ellipsis',
										whiteSpace: 'nowrap',
										fontSize: '0.68rem',
									}}
								>
									{formattedVal || '""'}
								</Typography>
							</Box>
						)
					})}

					{remainingCount > 0 && (
						<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', flexShrink: 0 }}>
							+{remainingCount} more
						</Typography>
					)}
				</Stack>
			</Box>
		</Tooltip>
	)
}
