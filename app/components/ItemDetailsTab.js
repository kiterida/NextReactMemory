import * as React from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { R2ImageGalleryDialog } from './R2ImageGalleryButton';
import MemoryItemWebLinksTab from './MemoryItemWebLinksTab';
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

const ItemDetailsTab = ({ selectedItem, setSelectedItem, onShowMessage, onRegisterRichTextDraftGetter }) => {
  const [value, setValue] = React.useState(0);
  const [galleryOpen, setGalleryOpen] = React.useState(false);
  const [headerGalleryOpen, setHeaderGalleryOpen] = React.useState(false);
  const [headerImageUploading, setHeaderImageUploading] = React.useState(false);
  const [isHeaderDragActive, setIsHeaderDragActive] = React.useState(false);
  const [isQuillReady, setIsQuillReady] = React.useState(false);
  const quillEditorRef = React.useRef(null);
  const quillToolbarRef = React.useRef(null);
  const quillInstanceRef = React.useRef(null);
  const savedRangeRef = React.useRef(null);
  const headerImageInputRef = React.useRef(null);
  const pendingRichTextRef = React.useRef(selectedItem?.rich_text || '');
  const pendingRichTextItemIdentityRef = React.useRef(String(selectedItem?.id ?? selectedItem?.source_item_id ?? ''));
  const selectedItemIdentity = String(selectedItem?.id ?? selectedItem?.source_item_id ?? '');

  const flushPendingRichText = React.useCallback(() => {
    if (pendingRichTextRef.current === undefined) {
      return;
    }

    setSelectedItem((prev) => {
      if (!prev) {
        return prev;
      }

      const currentPrevIdentity = String(prev?.id ?? prev?.source_item_id ?? '');
      if (currentPrevIdentity !== pendingRichTextItemIdentityRef.current) {
        return prev;
      }

      if ((prev.rich_text || '') === pendingRichTextRef.current) {
        return prev;
      }

      return { ...prev, rich_text: pendingRichTextRef.current };
    });
  }, [setSelectedItem]);

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

  const applyHeaderImage = React.useCallback((imageUrl) => {
    setSelectedItem((prev) => ({ ...prev, header_image: imageUrl }));
  }, [setSelectedItem]);

  const uploadHeaderImageFile = React.useCallback(async (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return;
    }

    setHeaderImageUploading(true);
    try {
      const imageUrl = await uploadImageToR2(file);
      applyHeaderImage(imageUrl);
    } catch (error) {
      console.error('Header image upload failed:', error);
      onShowMessage?.(error instanceof Error ? error.message : 'Header image upload failed.', 'error');
    } finally {
      setHeaderImageUploading(false);
    }
  }, [applyHeaderImage, onShowMessage, uploadImageToR2]);

  const insertImageAtSelection = React.useCallback((imageUrl) => {
    const quill = quillInstanceRef.current;
    if (!quill || !imageUrl) return;

    quill.focus();
    const range = quill.getSelection(true) || savedRangeRef.current || { index: quill.getLength(), length: 0 };

    if (range.length > 0) {
      quill.deleteText(range.index, range.length, 'silent');
    }

    quill.insertEmbed(range.index, 'image', imageUrl, 'user');
    quill.setSelection(range.index + 1, 0, 'silent');
    savedRangeRef.current = { index: range.index + 1, length: 0 };
  }, []);

  React.useEffect(() => {
    let isMounted = true;
    let handleTextChange;
    let handleSelectionChange;
    let handlePaste;
    let handleDrop;
    let handleDragOver;

    const initQuill = async () => {
      if (!quillEditorRef.current || !quillToolbarRef.current || quillInstanceRef.current) return;

      const { default: Quill } = await import('quill');
      if (!isMounted || !quillEditorRef.current) return;

      const quill = new Quill(quillEditorRef.current, {
        theme: 'snow',
        modules: {
          toolbar: {
            container: quillToolbarRef.current,
            handlers: {
              image: () => {
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
              },
              r2image: () => {
                savedRangeRef.current = quill.getSelection(true) || { index: quill.getLength(), length: 0 };
                setGalleryOpen(true);
              },
            },
          },
        },
      });

      const insertImageFromFile = async (file) => {
        if (!file || !file.type || !file.type.startsWith('image/')) return;
        savedRangeRef.current = quill.getSelection(true) || { index: quill.getLength(), length: 0 };

        try {
          const imageUrl = await uploadImageToR2(file);
          insertImageAtSelection(imageUrl);
        } catch (error) {
          console.error('Image upload failed:', error);
          onShowMessage?.(error instanceof Error ? error.message : 'Image upload failed.', 'error');
        }
      };

      handleTextChange = () => {
        pendingRichTextRef.current = quill.root.innerHTML;
        pendingRichTextItemIdentityRef.current = selectedItemIdentity;
      };

      handleSelectionChange = (range) => {
        if (range) {
          savedRangeRef.current = range;
          return;
        }

        flushPendingRichText();
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
      quill.on('selection-change', handleSelectionChange);
      quill.root.addEventListener('paste', handlePaste, true);
      quill.root.addEventListener('dragover', handleDragOver, true);
      quill.root.addEventListener('drop', handleDrop, true);
      quillInstanceRef.current = quill;
      setIsQuillReady(true);
    };

    initQuill();

    return () => {
      isMounted = false;
      if (quillInstanceRef.current && handleTextChange) {
        quillInstanceRef.current.off('text-change', handleTextChange);
      }
      if (quillInstanceRef.current && handleSelectionChange) {
        quillInstanceRef.current.off('selection-change', handleSelectionChange);
      }
      if (quillInstanceRef.current?.root && handlePaste) {
        quillInstanceRef.current.root.removeEventListener('paste', handlePaste, true);
      }
      if (quillInstanceRef.current?.root && handleDragOver) {
        quillInstanceRef.current.root.removeEventListener('dragover', handleDragOver, true);
      }
      if (quillInstanceRef.current?.root && handleDrop) {
        quillInstanceRef.current.root.removeEventListener('drop', handleDrop, true);
      }
      flushPendingRichText();
      quillInstanceRef.current = null;
      setIsQuillReady(false);
    };
  }, [flushPendingRichText, insertImageAtSelection, onShowMessage, setSelectedItem, uploadImageToR2]);

  React.useEffect(() => {
    const quill = quillInstanceRef.current;
    if (!quill || !isQuillReady || !selectedItemIdentity) return;

    const nextRichText = selectedItem?.rich_text || '';
    pendingRichTextRef.current = nextRichText;
    pendingRichTextItemIdentityRef.current = selectedItemIdentity;
    if (quill.root.innerHTML !== nextRichText) {
      quill.clipboard.dangerouslyPasteHTML(nextRichText, 'silent');
    }
  }, [isQuillReady, selectedItemIdentity]);

  React.useEffect(() => {
    if (!onRegisterRichTextDraftGetter) {
      return undefined;
    }

    const getCurrentDraft = () => ({
      itemIdentity: pendingRichTextItemIdentityRef.current,
      richText: pendingRichTextRef.current ?? '',
    });

    onRegisterRichTextDraftGetter(getCurrentDraft);

    return () => {
      onRegisterRichTextDraftGetter(null);
    };
  }, [onRegisterRichTextDraftGetter]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={handleChange} aria-label="basic tabs">
          <Tab label="Item" {...a11yProps(0)} />
          <Tab label="Description" {...a11yProps(1)} />
          <Tab label="Code Snippet" {...a11yProps(2)} />
          <Tab label="Links" {...a11yProps(3)} />
          <Tab label="Header Image" {...a11yProps(4)} />
          <Tab label="React-Quill" {...a11yProps(5)} />
        </Tabs>
      </Box>

      <CustomTabPanel value={value} index={0}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Memory Key"
            value={selectedItem.memory_key || ''}
            onChange={(e) => setSelectedItem({ ...selectedItem, memory_key: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Item Order"
            value={selectedItem.row_order || ''}
            onChange={(e) => setSelectedItem({ ...selectedItem, row_order: e.target.value })}
            fullWidth
            margin="normal"
          />
        </Stack>
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
        <MemoryItemWebLinksTab selectedItem={selectedItem} onShowMessage={onShowMessage} />
      </CustomTabPanel>

      <CustomTabPanel value={value} index={4}>
        <Stack spacing={2}>
          {selectedItem.header_image ? (
            <Box
              component="img"
              src={selectedItem.header_image}
              alt={selectedItem.name || 'Header image'}
              sx={{
                width: '100%',
                maxHeight: 280,
                objectFit: 'cover',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'grey.100',
              }}
            />
          ) : null}

          <Box
            onDragOver={(event) => {
              if (event.dataTransfer?.files?.length) {
                event.preventDefault();
                setIsHeaderDragActive(true);
              }
            }}
            onDragLeave={() => setIsHeaderDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsHeaderDragActive(false);

              const files = event.dataTransfer?.files;
              if (!files || !files.length) return;

              const imageFile = Array.from(files).find((file) => file.type.startsWith('image/'));
              if (!imageFile) return;

              void uploadHeaderImageFile(imageFile);
            }}
            sx={{
              minHeight: 220,
              border: '2px dashed',
              borderColor: isHeaderDragActive ? 'primary.main' : 'divider',
              borderRadius: 3,
              bgcolor: isHeaderDragActive ? 'action.hover' : 'background.default',
              transition: 'border-color 160ms ease, background-color 160ms ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 3,
              textAlign: 'center',
            }}
          >
            <Stack spacing={2} alignItems="center">
              {headerImageUploading ? <CircularProgress size={28} /> : null}
              <Typography variant="body1">
                Drag in an image from your computer or upload
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => headerImageInputRef.current?.click()}
                  disabled={headerImageUploading}
                >
                  Upload Image
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setHeaderGalleryOpen(true)}
                  disabled={headerImageUploading}
                >
                  Choose From R2
                </Button>
              </Stack>
            </Stack>
          </Box>

          <input
            ref={headerImageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void uploadHeaderImageFile(file);
              }
              event.target.value = '';
            }}
          />

          <TextField
            label="Header Image URL"
            value={selectedItem.header_image || ''}
            onChange={(e) => setSelectedItem({ ...selectedItem, header_image: e.target.value })}
            fullWidth
            margin="normal"
          />
        </Stack>
      </CustomTabPanel>

      <CustomTabPanel value={value} index={5}>
        <Box
          className="ql-toolbar ql-snow"
          ref={quillToolbarRef}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderBottom: 0,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          }}
        >
          <span className="ql-formats">
            <select className="ql-header" defaultValue="">
              <option value="1">Heading</option>
              <option value="2">Subheading</option>
              <option value="">Normal</option>
            </select>
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-bold" aria-label="Bold" />
            <button type="button" className="ql-italic" aria-label="Italic" />
            <button type="button" className="ql-underline" aria-label="Underline" />
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-list" value="ordered" aria-label="Ordered list" />
            <button type="button" className="ql-list" value="bullet" aria-label="Bullet list" />
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-link" aria-label="Insert link" />
            <button type="button" className="ql-image" aria-label="Upload image" />
            <button type="button" className="ql-r2image" aria-label="Insert from R2" title="Insert from R2">
              R2
            </button>
          </span>
          <span className="ql-formats">
            <button type="button" className="ql-clean" aria-label="Clear formatting" />
          </span>
        </Box>
        <Box ref={quillEditorRef} />
        <R2ImageGalleryDialog
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          onSelectImage={insertImageAtSelection}
        />
      </CustomTabPanel>

      <R2ImageGalleryDialog
        open={headerGalleryOpen}
        onClose={() => setHeaderGalleryOpen(false)}
        onSelectImage={applyHeaderImage}
      />
    </Box>
  );
};

export default ItemDetailsTab;





