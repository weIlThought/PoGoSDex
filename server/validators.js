// Centralized lightweight input validators for admin API payloads

const isString = (v) => typeof v === 'string';
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isBoolean = (v) => typeof v === 'boolean';
const isNumberLike = (v) => v !== null && v !== '' && Number.isFinite(Number(v));
const isArrayOfStrings = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

export function validateDevicePayload(body = {}) {
  const errors = [];
  const {
    name,
    model,
    brand,
    type,
    os,
    compatible,
    notes,
    manufacturer_url,
    root_links,
    price_range,
    pogo_comp,
    description,
    image_url,
    status,
  } = body;

  const deviceName = (name && name.trim()) || (isString(model) && model.trim()) || '';
  if (!deviceName) errors.push('model or name required');

  if (brand != null && !isString(brand)) errors.push('brand must be string');
  if (type != null && !isString(type)) errors.push('type must be string');
  if (os != null && !isString(os)) errors.push('os must be string');
  if (compatible != null && !isBoolean(compatible)) errors.push('compatible must be boolean');
  if (description != null && !isString(description)) errors.push('description must be string');
  if (image_url != null && !isString(image_url)) errors.push('image_url must be string');
  if (status != null && !isString(status)) errors.push('status must be string');
  if (manufacturer_url != null && !isString(manufacturer_url))
    errors.push('manufacturer_url must be string');
  if (price_range != null && !isString(price_range)) errors.push('price_range must be string');
  if (pogo_comp != null && !isString(pogo_comp)) errors.push('pogo_comp must be string');

  if (notes != null && !(isArrayOfStrings(notes) || isString(notes)))
    errors.push('notes must be array of strings or string');
  if (root_links != null && !(isArrayOfStrings(root_links) || isString(root_links)))
    errors.push('root_links must be array of strings or string');

  return { ok: errors.length === 0, errors };
}

export function validateNewsPayload(body = {}) {
  const errors = [];
  const { title, content, slug, excerpt, image_url, published, publishedAt, updatedAt, tags } =
    body;

  if (!isNonEmptyString(title)) errors.push('title required');
  if (!isNonEmptyString(content)) errors.push('content required');

  if (slug != null && !isString(slug)) errors.push('slug must be string');
  if (excerpt != null && !isString(excerpt)) errors.push('excerpt must be string');
  if (image_url != null && !isString(image_url)) errors.push('image_url must be string');
  if (published != null && !(published === 0 || published === 1 || typeof published === 'boolean'))
    errors.push('published must be boolean or 0/1');
  if (publishedAt != null && !isString(publishedAt)) errors.push('publishedAt must be string');
  if (updatedAt != null && !isString(updatedAt)) errors.push('updatedAt must be string');
  if (tags != null && !(isArrayOfStrings(tags) || isString(tags)))
    errors.push('tags must be array of strings or string');

  return { ok: errors.length === 0, errors };
}

export function validateCoordPayload(body = {}) {
  const errors = [];
  const { category = 'top10', name, lat, lng, note, tags } = body;

  if (!isNonEmptyString(name)) errors.push('name required');
  if (!isNumberLike(lat) || !isNumberLike(lng)) errors.push('lat/lng required');
  if (!['top10', 'notable', 'raid_spots'].includes(category)) errors.push('invalid category');
  if (note != null && !isString(note)) errors.push('note must be string');
  if (tags != null && !(isArrayOfStrings(tags) || isString(tags)))
    errors.push('tags must be array of strings or string');

  return { ok: errors.length === 0, errors };
}

export function validateIssuePayload(body = {}) {
  const errors = [];
  const { title, content, status, tags } = body;
  if (!isNonEmptyString(title)) errors.push('title required');
  if (!isNonEmptyString(content)) errors.push('content required');
  const allowed = ['open', 'in_progress', 'closed', 'resolved', 'blocked'];
  if (status != null && !allowed.includes(String(status))) errors.push('invalid status');
  if (tags != null && !(isArrayOfStrings(tags) || isString(tags)))
    errors.push('tags must be array of strings or string');
  return { ok: errors.length === 0, errors };
}
