'use client';
import React from 'react';
import MemoriesView from '../../components/MemoriesView';



import SearchIcon from '@mui/icons-material/Search';
import { TextField, Stack, IconButton, Tooltip } from '@mui/material';



const StarredLists = () => {
    return <MemoriesView filterStarred/>;
}

export default StarredLists;