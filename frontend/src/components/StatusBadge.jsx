// Maps a status/text string to a coloured badge.
const MAP = {
  Delivered: 'badge-green',
  Paid: 'badge-green',
  'Out for Delivery': 'badge-blue',
  Preparing: 'badge-blue',
  Assigned: 'badge-amber',
  Pending: 'badge-amber',
  Cancelled: 'badge-red',
  Failed: 'badge-red',
};

export default function StatusBadge({ value }) {
  const cls = MAP[value] || 'badge-gray';
  return <span className={`badge ${cls}`}>{value}</span>;
}
