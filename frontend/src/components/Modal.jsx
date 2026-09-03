// Simple reusable modal. Renders children as the body; caller supplies
// the footer buttons via props.
export default function Modal({ title, onClose, onSubmit, submitLabel = 'Save', children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="modal-head">
            <h3>{title}</h3>
            <button type="button" className="close-x" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">{children}</div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
