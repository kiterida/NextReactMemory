'use client';
import React, {useState} from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Input from '@mui/material/Input';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import { FormControl } from '@mui/material';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';


const BudgetPage = () => {

    const [message, setMessage] = useState("");

    function doIt() {
        setMessage("bang");
    }

    return (
        <>
        <Box>
        <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
        <InputLabel htmlFor="expenseAmount">Amount</InputLabel>
        <OutlinedInput
            id="expenseAmount"
            startAdornment={<InputAdornment position="start">$</InputAdornment>}
            label="Amount"
          />
          </FormControl>
        <FormControl sx={{ m: 1, width: '45ch' }} variant="outlined">
          <InputLabel htmlFor="expenseDescription">Description</InputLabel>
          <OutlinedInput
            id="expenseDescription"
            label="Description"
          />
        </FormControl>
         <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
        <Button variant="contained" sx={{ height: '56px'}} onClick={doIt} endIcon={<AddIcon />}>
            Add
        </Button>
        </FormControl>
        </Box>
        { message && 
        <Box>
            {message}
        </Box>
        }
        </>
    )
};

export default BudgetPage;