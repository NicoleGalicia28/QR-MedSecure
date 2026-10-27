import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Password field with a show/hide (eye) toggle.
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="form-input-wrap">
      <input
        id={id}
        type={show ? "text" : "password"}
        className="form-input form-input--toggle"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="form-eye"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        title={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
}