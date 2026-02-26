import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import 'quill/dist/quill.snow.css';

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
  const quillEditorRef = React.useRef(null);
  const quillInstanceRef = React.useRef(null);

  //console.log('selected item = ', selectedItem);

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const uploadImageToR2 = React.useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/r2-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || 'Image upload failed');
    }

    const payload = await response.json();
    return payload.url;
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    let handleTextChange;
    let handlePaste;
    let handleDrop;
    let handleDragOver;

    const initQuill = async () => {
      if (!quillEditorRef.current || quillInstanceRef.current) return;

      const { default: Quill } = await import('quill');
      if (!isMounted || !quillEditorRef.current) return;

      const quill = new Quill(quillEditorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image'],
            ['clean'],
          ],
        },
      });

      const insertImageFromFile = async (file) => {
        if (!file || !file.type || !file.type.startsWith('image/')) return;
        const range = quill.getSelection(true) || { index: quill.getLength(), length: 0 };

        try {
          const imageUrl = await uploadImageToR2(file);
          quill.insertEmbed(range.index, 'image', imageUrl, 'user');
          quill.setSelection(range.index + 1, 0, 'silent');
        } catch (error) {
          console.error('Image upload failed:', error);
        }
      };

      const toolbar = quill.getModule('toolbar');
      toolbar?.addHandler('image', () => {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.onchange = () => {
          const file = input.files?.[0];
          if (file) {
            void insertImageFromFile(file);
          }
        };
        input.click();
      });

      handleTextChange = () => {
        setSelectedItem((prev) => ({ ...prev, rich_text: quill.root.innerHTML }));
      };

      handlePaste = (event) => {
        const items = event.clipboardData?.items;
        if (!items || !items.length) return;

        const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'));
        if (!imageItem) return;

        const file = imageItem.getAsFile();
        if (!file) return;

        event.preventDefault();
        void insertImageFromFile(file);
      };

      handleDragOver = (event) => {
        if (event.dataTransfer?.files?.length) {
          event.preventDefault();
        }
      };

      handleDrop = (event) => {
        const files = event.dataTransfer?.files;
        if (!files || !files.length) return;

        const imageFile = Array.from(files).find((file) => file.type.startsWith('image/'));
        if (!imageFile) return;

        event.preventDefault();
        void insertImageFromFile(imageFile);
      };

      quill.on('text-change', handleTextChange);
      quill.root.addEventListener('paste', handlePaste);
      quill.root.addEventListener('dragover', handleDragOver);
      quill.root.addEventListener('drop', handleDrop);
      quillInstanceRef.current = quill;
    };

    initQuill();

    return () => {
      isMounted = false;
      if (quillInstanceRef.current && handleTextChange) {
        quillInstanceRef.current.off('text-change', handleTextChange);
      }
      if (quillInstanceRef.current?.root && handlePaste) {
        quillInstanceRef.current.root.removeEventListener('paste', handlePaste);
      }
      if (quillInstanceRef.current?.root && handleDragOver) {
        quillInstanceRef.current.root.removeEventListener('dragover', handleDragOver);
      }
      if (quillInstanceRef.current?.root && handleDrop) {
        quillInstanceRef.current.root.removeEventListener('drop', handleDrop);
      }
      quillInstanceRef.current = null;
    };
  }, [setSelectedItem, uploadImageToR2]);

  React.useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill) return;

    const nextRichText = selectedItem?.rich_text || '';
    if (quill.root.innerHTML !== nextRichText) {
      quill.clipboard.dangerouslyPasteHTML(nextRichText, 'silent');
    }
  }, [selectedItem?.rich_text]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs">
          <Tab label="Item" {...a11yProps(0)} />
          <Tab label="Description" {...a11yProps(1)} />
          <Tab label="Code Snippet" {...a11yProps(2)} />
          <Tab label="Image (link)" {...a11yProps(3)} />
          <Tab label="React-Quill" {...a11yProps(4)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={value} index={0}>
        <TextField
          label="Memory Key"
          value={selectedItem.memory_key || ''}
          onChange={(e) => setSelectedItem({ ...selectedItem, memory_key: e.target.value })}
          fullWidth
          margin="normal"
        />
        <TextField
          label="Memory Name"
          value={selectedItem.name || ''}
          onChange={(e) => setSelectedItem({ ...selectedItem, name: e.target.value })}
          fullWidth
          multiline
          rows={4}
          margin="normal"
        />
        <TextField
          label="Memory Image"
          value={selectedItem.memory_image || ''}
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

      <CustomTabPanel value={value} index={4}>
        <Box ref={quillEditorRef} />
      </CustomTabPanel>
    </Box>
  );
};

export default ItemDetailsTab;
