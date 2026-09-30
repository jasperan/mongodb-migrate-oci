import { Badge } from '../ui/Display'

// Status vocabulary of the migrated data: cart-item statuses (Processing,
// Shipped, Delivered, Cancelled, Not processed) and merchant/review workflow
// statuses (Waiting Approval, Approved, Rejected).
const TONES = {
  Delivered: 'success',
  Approved: 'success',
  Shipped: 'duality',
  Processing: 'warning',
  'Waiting Approval': 'warning',
  Rejected: 'brand',
  Cancelled: 'brand',
  'Not processed': 'neutral'
}

export function StatusBadge({ status, className }) {
  if (!status) return <Badge className={className}>Unknown</Badge>
  return (
    <Badge tone={TONES[status] || 'neutral'} className={className}>
      {status}
    </Badge>
  )
}
