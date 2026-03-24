export const EMPTY_MEMORY_ITEM_WEB_LINK_FORM = {
  link_heading: '',
  url: '',
  row_order: '',
  description: '',
  image_url: '',
};

export const isValidHttpUrl = (value) => {
  const trimmedValue = String(value ?? '').trim();
  if (!trimmedValue) {
    return false;
  }

  try {
    const parsed = new URL(trimmedValue);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
};

export const validateMemoryItemWebLinkForm = (values) => {
  const errors = {};

  if (!String(values?.link_heading ?? '').trim()) {
    errors.link_heading = 'Heading is required.';
  }

  if (!String(values?.url ?? '').trim()) {
    errors.url = 'URL is required.';
  } else if (!isValidHttpUrl(values?.url)) {
    errors.url = 'Enter a valid http or https URL.';
  }

  const rowOrderValue = String(values?.row_order ?? '').trim();
  if (rowOrderValue.length > 0) {
    const parsed = Number(rowOrderValue);
    if (!Number.isInteger(parsed)) {
      errors.row_order = 'Row order must be a whole number.';
    }
  }

  const imageUrlValue = String(values?.image_url ?? '').trim();
  if (imageUrlValue && !isValidHttpUrl(imageUrlValue)) {
    errors.image_url = 'Enter a valid image URL.';
  }

  return errors;
};

export const normalizeMemoryItemWebLinkInput = (values, memoryItemId) => ({
  memory_item_id: memoryItemId,
  link_heading: String(values?.link_heading ?? '').trim(),
  url: String(values?.url ?? '').trim(),
  row_order: String(values?.row_order ?? '').trim(),
  description: String(values?.description ?? '').trim(),
  image_url: String(values?.image_url ?? '').trim(),
});

export const getNextMemoryItemWebLinkKey = (links = []) => {
  const numericKeys = links
    .map((link) => Number(link?.row_order))
    .filter((value) => Number.isFinite(value));

  if (numericKeys.length === 0) {
    return 0;
  }

  return Math.max(...numericKeys) + 1;
};


