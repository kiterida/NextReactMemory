import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Box, Card, CardContent } from '@mui/material';

const CodeSnippet = ({ code }) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ overflow: 'auto', maxHeight: '400px' }}>
          <SyntaxHighlighter language="javascript" style={materialDark} wrapLongLines>
            {code}
          </SyntaxHighlighter>
        </Box>
      </CardContent>
    </Card>
  );
};

export default CodeSnippet;
