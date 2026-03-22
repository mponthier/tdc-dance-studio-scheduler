import Modal from './Modal'

export default function ConfirmDialog({ message, onConfirm, onCancel, title = 'Confirm Delete', confirmLabel = 'Delete' }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="modal-body">
        <p style={{ fontSize: '14px', color: 'var(--color-text)' }}>{message}</p>
      </div>
      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
