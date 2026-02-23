import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      sx={{
        display: value === index ? 'block' : 'none',
        padding: 2,
      }}
      {...other}
    >
      {children}
    </Box>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

const ItemDetailsTab = ({ selectedItem, setSelectedItem }) => {
  const [value, setValue] = React.useState(0);

  //console.log('selected item = ', selectedItem);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs">
          <Tab label="Item" {...a11yProps(0)} />
          <Tab label="Description" {...a11yProps(1)} />
          <Tab label="Code Snippet" {...a11yProps(2)} />
          <Tab label="Image (link)" {...a11yProps(3)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={value} index={0}>
        <TextField
          label="Memory Key"
          value={selectedItem.memory_key}
          onChange={(e) => setSelectedItem({ ...selectedItem, memory_key: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Memory Name"
          value={selectedItem.name}
          onChange={(e) => setSelectedItem({ ...selectedItem, name: e.target.value })}
          fullWidth
          multiline
          rows={4}
          margin="normal"
        />
        <TextField
          label="Memory Image"
          value={selectedItem.memory_image}
          onChange={(e) => setSelectedItem({ ...selectedItem, memory_image: e.target.value })}
          fullWidth
          multiline
          rows={4}
          margin="normal"
        />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={1}>
        <TextField
          label="Description"
          value={selectedItem.description || ''}
          onChange={(e) => setSelectedItem({ ...selectedItem, description: e.target.value })}
          fullWidth
          multiline
          minRows={12}
          margin="normal"
          sx={{
            '& .MuiInputBase-inputMultiline': {
              minHeight: '5vh',
              resize: 'vertical',
            },
          }}
        />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={2}>
        <TextField
          label="Code Snippet"
          value={selectedItem.code_snippet || ''}
          onChange={(e) => setSelectedItem({ ...selectedItem, code_snippet: e.target.value })}
          fullWidth
          multiline
          rows={4}
          margin="normal"
        />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={3}>
        <TextField
          label="Image URL"
          value={selectedItem.memory_image || ''}
          onChange={(e) => setSelectedItem({ ...selectedItem, memory_image: e.target.value })}
          fullWidth
          margin="normal"
        />
      </CustomTabPanel>
    </Box>
  );
};

export default ItemDetailsTab;
