'use client';
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { Button } from '@mui/material';
/* This page is currently not used */
const TestPage = (props) => {

    const [showSnackBar, setShowSnackBar] = useState(false);

    return (
        <>
            <Button onClick={() => { alert('Kaboom') }}>Press Me</Button>
        </>
    )
};

export default TestPage;