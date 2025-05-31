'use client';
import React, { useState } from 'react';
import { Box, TextField, Switch, Button, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';

const MemoryTester = () => {

    const [memoryIndex, setMemoryIndex] = useState('1');
    const [showFields, setShowFields] = useState(true);

    return (
         <Box sx={{ flexGrow: 1 }}>
            <Grid container spacing={2}>
                <Grid container spacing={2}>
                
                { /* conditional rendering */ }
                {showFields && ( <Grid size={{ xs: 12, md: 6 }}>
                
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <TextField
                    id="memoryIndexTextField"
                    label="Memory Index"
                    variant="outlined"
                    value={memoryIndex}
                    fullWidth
                />
                </Box>
                </Grid>)}
                </Grid>
                </Grid>
                </Box>
    )
};

export default MemoryTester;