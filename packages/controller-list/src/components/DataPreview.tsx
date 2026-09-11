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

	// 1. Primitive: string, number, boolean
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

	// 2. Array
	if (Array.isArray(data)) {
		if (data.length === 0) {
			return null
		}

		// Array of objects -> Tabular representation
		if (typeof data[0] === 'object' && data[0] !== null) {
			const rows = data.slice(0, 3)
			const keys = Array.from(
				new Set(
					rows.flatMap((r) => (typeof r === 'object' && r !== null ? Object.keys(r as Record<string, unknown>) : []))
				)
			).slice(0, 4)

			const jsonStr = JSON.stringify(data, null, 2)

			return (
				<Tooltip title={<pre style={{ margin: 0, fontSize: '0.75rem' }}>{jsonStr}</pre>}>
					<Box
						sx={{
							mt: 0.25,
							p: 0.5,
							bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
							borderRadius: 1,
							border: '1px solid',
							borderColor: 'divider',
							overflowX: 'auto',
							maxWidth: '100%',
						}}
					>
						<Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.25}>
							<Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
								Table ({data.length} item{data.length === 1 ? '' : 's'})
							</Typography>
						</Stack>

						<table
							style={{
								width: '100%',
								borderCollapse: 'collapse',
								fontSize: '0.65rem',
								fontFamily: 'monospace',
							}}
						>
							<thead>
								<tr>
									{keys.map((k) => (
										<th
											key={k}
											style={{
												textAlign: 'left',
												padding: '1px 4px',
												borderBottom: '1px solid rgba(128, 128, 128, 0.3)',
												opacity: 0.7,
											}}
										>
											{k}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row, rIdx) => (
									<tr key={rIdx}>
										{keys.map((k) => {
											const cellVal: unknown =
												typeof row === 'object' && row !== null ? (row as Record<string, unknown>)[k] : ''
											return (
												<td
													key={k}
													style={{
														padding: '1px 4px',
														whiteSpace: 'nowrap',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														maxWidth: 90,
													}}
												>
													{typeof cellVal === 'object' && cellVal !== null
														? JSON.stringify(cellVal)
														: `${(cellVal as string | number | boolean | undefined) ?? ''}`}
												</td>
											)
										})}
									</tr>
								))}
							</tbody>
						</table>

						{data.length > 3 && (
							<Typography
								variant="caption"
								color="text.disabled"
								sx={{ display: 'block', mt: 0.25, fontSize: '0.65rem' }}
							>
								+{data.length - 3} more row{data.length - 3 === 1 ? '' : 's'}
							</Typography>
						)}
					</Box>
				</Tooltip>
			)
		}

		// Array of primitives -> compact list of chips
		const displayItems = data.slice(0, 4)
		const remaining = data.length - displayItems.length

		return (
			<Box sx={{ mt: 0.25 }}>
				<Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
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
						<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
							+{remaining} more
						</Typography>
					)}
				</Stack>
			</Box>
		)
	}

	// 3. Object / Key-Value map
	const obj = data as Record<string, unknown>
	const keys = Object.keys(obj)
	if (keys.length === 0) {
		return null
	}

	const displayKeys = keys.slice(0, 4)
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
				}}
			>
				<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
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
						<Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
							+{remainingCount} more
						</Typography>
					)}
				</Stack>
			</Box>
		</Tooltip>
	)
}
