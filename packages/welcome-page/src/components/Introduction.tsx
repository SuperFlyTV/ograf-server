import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export const Introduction: React.FC<{
	namespaceId: string
}> = ({ namespaceId }) => {
	return (
		<Box sx={{ textAlign: 'center', py: 3 }}>
			<Typography
				variant="h3"
				sx={{
					fontSize: '2.5rem',
					fontWeight: 'bold',
					color: '#1976d2',
					mb: 2,
					wordBreak: 'break-all',
				}}
			>
				{namespaceId}
			</Typography>
			<Typography variant="h6" sx={{ mt: 2 }}>
				This is your namespace, don't lose it!
			</Typography>
		</Box>
	)
}
