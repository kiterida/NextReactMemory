import * as React from 'react';
import PropTypes from 'prop-types';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

const MemoryItemWebLinksList = ({ links, loading = false, onEdit, onDelete }) => {
  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 3 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading links...
        </Typography>
      </Stack>
    );
  }

  if (!links.length) {
    return <Alert severity="info">No links added for this item.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {links.map((link) => (
        <Card key={link.id} variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1">{link.link_heading}</Typography>
                  <Link href={link.url} target="_blank" rel="noopener noreferrer" underline="hover">
                    {link.url}
                  </Link>
                </Stack>
              </Stack>

              {link.description ? (
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {link.description}
                </Typography>
              ) : null}

              {link.image_url ? (
                <Box
                  component="img"
                  src={link.image_url}
                  alt={link.link_heading}
                  sx={{
                    width: 96,
                    height: 96,
                    objectFit: 'cover',
                    borderRadius: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'grey.100',
                  }}
                />
              ) : null}

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button size="small" variant="outlined" onClick={() => onEdit(link)}>
                  Edit
                </Button>
                <Button size="small" color="error" variant="outlined" onClick={() => onDelete(link)}>
                  Delete
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
};

MemoryItemWebLinksList.propTypes = {
  links: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    link_heading: PropTypes.string,
    url: PropTypes.string,
    description: PropTypes.string,
    image_url: PropTypes.string,
    row_order: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })),
  loading: PropTypes.bool,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

MemoryItemWebLinksList.defaultProps = {
  links: [],
  loading: false,
};

export default MemoryItemWebLinksList;


