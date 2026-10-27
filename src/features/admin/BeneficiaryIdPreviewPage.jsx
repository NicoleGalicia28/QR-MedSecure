import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import { QrCode, Printer, Download, Activity, Camera, X, RefreshCcw } from "lucide-react";
import { getSession } from "../auth/authStore";
import { useEndpoint } from "../../lib/useApi";
import { Loading, ErrorState } from "../../lib/ui";
import "../admin/DashboardPage.css";
import "./BeneficiaryIdPreview.css";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "1964-02-14" → "14 Feb 1964"
function fmtDob(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function fmtDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
  if (!m) return "—";
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

// GET /beneficiaries/:id → { beneficiary } for the ID card preview.
const selectBeneficiary = (res) => {
  const b = res?.beneficiary;
  if (!b) return null;
  const first = b.firstName || "";
  const last = b.lastName || "";
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "—";
  return {
    name: `${first} ${last}`.trim() || "—",
    initials,
    beneficiaryId: b.publicId || "—",
    dob: fmtDob(b.birthDate),
    sex: b.sex || "—",
    address: b.address || "—",
    issued: fmtDate(b.createdAt),
  };
};

export default function BeneficiaryIdPreviewPage() {
  const { id } = useParams();
  const location = useLocation();
  const beneficiaryId = id || "";

  const session = getSession();
  const preparedBy = session
    ? `${session.firstName} ${session.lastName} · Secretary (Admin)`
    : "Secretary (Admin)";

  const { data: card, isLoading, error, refetch } = useEndpoint(
    beneficiaryId ? `/beneficiaries/${encodeURIComponent(beneficiaryId)}` : "",
    selectBeneficiary,
    { enabled: Boolean(beneficiaryId) }
  );

  const [printLayout, setPrintLayout] = useState("Front & back · Actual size");
  const [fileFormat, setFileFormat] = useState("PDF · Print quality");
  const [photo, setPhoto] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | starting | preview
  const [cameraError, setCameraError] = useState("");

  // Use the issued single-use QR from the generate page when available, otherwise
  // fall back to the beneficiary reference QR.
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const issued = location.state?.qrDataUrl;
    if (issued) {
      setQrDataUrl(issued);
      return;
    }
    setQrDataUrl("");
  }, [beneficiaryId, location.state]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(
    () => () => {
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    []
  );

  // Save ID → downloads the ID as PDF.
  const handleSave = () => {
    if (!qrDataUrl) {
      setSaveError("QR image is not ready yet.");
      return;
    }
    setSaveError("");
    try {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.onload = () => {
        const cards = document.querySelectorAll(".id-front, .id-back");
        if (cards.length === 0) {
          setSaveError("Card not found.");
          return;
        }
        const jsPDFScript = document.createElement("script");
        jsPDFScript.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
        jsPDFScript.onload = async () => {
          const JsPDF = window.jspdf?.jsPDF || window.jsPDF;
          const pdf = new JsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
          for (let i = 0; i < cards.length; i++) {
            const canvas = await window.html2canvas(cards[i], { scale: 4, useCORS: true });
            const imgData = canvas.toDataURL("image/png");
            if (i > 0) pdf.addPage([85.6, 54], "landscape");
            pdf.addImage(imgData, "PNG", 0, 0, 85.6, 54);
          }
          pdf.save(`Beneficiary-ID-${card?.beneficiaryId || beneficiaryId}.pdf`);
        };
        document.body.appendChild(jsPDFScript);
      };
      document.body.appendChild(script);
    } catch (err) {
      setSaveError(err?.message || "Failed to generate PDF.");
    }
  };

  // Print ID → the browser print dialog on the card layout.

  const startCamera = async () => {
    if (streamRef.current) return;
    setPhase("starting");
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setPhase("preview");
    } catch (err) {
      console.error("Camera error", err);
      setPhase("idle");
      setCameraError(
        "Camera could not be opened. Allow camera access for this site (localhost or HTTPS) and retry."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setPhoto(dataUrl);
    stopCamera();
  };

  const retake = () => {
    setPhoto(null);
    startCamera();
  };

  const stopCamera = () => {
    const stream = streamRef.current;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase("idle");
  };

  const statusText = {
    idle: "Camera off",
    starting: "Opening camera…",
    preview: "Ready to capture ID photo",
  }[phase];

  if (isLoading && !card) return <Loading label="Loading beneficiary record…" />;
  if (error) {
    return (
      <ErrorState
        title="Could not load this beneficiary"
        message={error}
        onRetry={refetch}
      />
    );
  }
  if (!card) {
    return (
      <ErrorState
        title="Beneficiary not found"
        message="Open an ID from the beneficiary ID directory."
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <div className="bip-header">
        <div>
          <h1 className="bip-header__title">Beneficiary ID preview</h1>
          <p className="bip-header__subtitle">
            Secretary (Admin) · {card.name} · Front and back designs ready for review.
          </p>
        </div>
        <div className="bip-header__actions">
          <button
            type="button"
            className="bip-btn bip-btn--outline"
            onClick={handleSave}
            disabled={!qrDataUrl}
          >
            <Download size={14} strokeWidth={2.5} />
            Save ID
          </button>
          <button
            type="button"
            className="bip-btn bip-btn--primary"
            onClick={() => window.print()}
          >
            <Printer size={14} strokeWidth={2.5} />
            Print ID
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bip-info-banner" role="alert" style={{ borderColor: "#fca5a5" }}>
          <strong>{saveError}</strong>
        </div>
      )}

      <div className="bip-steps">
        {["Review beneficiary", "QR generated", "Create ID", "Save or print"].map((s, i) => (
          <div
            key={s}
            className={"bip-step " + (i < 3 ? "bip-step--done" : "bip-step--active")}
          >
            <span className="bip-step__num">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>

      <div className="bip-info-banner">
        <strong>ID card preview · Save downloads the QR reference image</strong>
        Review the identity fields and both sides before production. The QR
        encodes the beneficiary ID reference only — no medical data.
      </div>

      <div className="bip-panel">
        <h2 className="bip-panel__title">Front & back card designs</h2>
        <p className="bip-panel__subtitle">
          85.6 × 54 mm · 300 DPI · 1 mm bleed no extended for readability.
        </p>

        <div className="bip-layout">
          <div className="bip-cards">
            <div>
              <p className="bip-card-label">• Front · 85.6 × 54 mm</p>
              <div className="id-front">
                <div className="id-front__header">
                  <div className="id-front__brand-icon">
                    <Activity size={16} strokeWidth={2.5} />
                  </div>
                  <div>
                    <div className="id-front__brand-title">QR-MedSecure</div>
                    <div className="id-front__brand-sub">
                      BARANGAY HEALTH ACCESS · BARANGAY 354 TAYUMAN · MANILA
                    </div>
                  </div>
                </div>

                <div className="id-front__body">
                  {photo ? (
                    <img src={photo} alt="Beneficiary ID photo" className="id-front__photo" />
                  ) : (
                    <div className="id-front__avatar">{card.initials}</div>
                  )}

                  <div className="id-front__meta">
                    <p className="id-front__name">{card.name}</p>
                    <p className="id-front__id">{card.beneficiaryId}</p>
                    <div className="id-front__grid">
                      <div>
                        <p className="id-front__grid-label">Date of birth</p>
                        <p className="id-front__grid-value">{card.dob}</p>
                      </div>
                      <div>
                        <p className="id-front__grid-label">Sex</p>
                        <p className="id-front__grid-value">{card.sex}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="id-front__address">{card.address}</p>

                <div className="id-front__footer">
                  <span className="id-front__footer-label">Community · Health access</span>
                  <span className="id-front__footer-date">Issued {card.issued}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="bip-card-label">• Back · 85.6 × 54 mm</p>
              <div className="id-back">
                <div className="id-back__qr">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${card.beneficiaryId}`}
                      width={100}
                      height={100}
                      style={{ display: "block" }}
                    />
                  ) : (
                    <QrCode size={100} strokeWidth={1} color="#0a3d3d" />
                  )}
                  <span className="id-back__qr-label">{card.beneficiaryId}</span>
                </div>

                <div className="id-back__meta">
                  <p className="id-back__title">Secure beneficiary lookup</p>
                  <p className="id-back__sub">
                    Present this ID to authorized barangay health staff. The embedded QR is the issued single-use credential for dispensing and identity verification.
                  </p>
                  <p className="id-back__contact">
                    <strong>If found, return to:</strong>
                    <br />
                    Barangay 354 Tayuman Health Center
                    <br />
                    0917 555 0142
                  </p>
                  <p className="id-back__legal">
                    This is not a government-issued ID. The QR contains the issued beneficiary credential reference.
                    <br />
                    QR-{card.beneficiaryId} · QR-MedSecure
                  </p>
                </div>
              </div>
            </div>
          </div>

          <aside className="bip-summary">
            <p className="bip-summary__name">{card.name}</p>

            <div className="bip-summary-row">
              <p className="bip-summary__label">Beneficiary ID</p>
              <p className="bip-summary__value">{card.beneficiaryId}</p>
            </div>

            <div className="bip-summary-row">
              <p className="bip-summary__label">QR reference</p>
              <p className="bip-summary__value">{card.beneficiaryId} · included on back</p>
            </div>

            <div className="bip-summary-row">
              <p className="bip-summary__label">Prepared by</p>
              <p className="bip-summary__value bip-summary__value--muted">{preparedBy}</p>
            </div>

            <div className="bip-summary-row">
              <p className="bip-summary__label">Print layout</p>
              <select
                className="bip-select"
                value={printLayout}
                onChange={(e) => setPrintLayout(e.target.value)}
              >
                <option>Front & back · Actual size (85.6 × 54 mm)</option>
                <option>Front only · Actual size</option>
                <option>Front & back · A4 (2 cards)</option>
              </select>
            </div>

            <div className="bip-summary-row">
              <p className="bip-summary__label">File format</p>
              <select
                className="bip-select"
                value={fileFormat}
                onChange={(e) => setFileFormat(e.target.value)}
              >
                <option>PDF · Print quality</option>
              </select>
            </div>

            <div className="bip-summary-row">
              <p className="bip-summary__label">ID photo</p>
              <div className="bip-photo__wrap">
                <div className="bip-photo__stage">
                  <video ref={videoRef} className="bip-photo__video" playsInline muted />
                  <canvas ref={canvasRef} className="bip-photo__canvas" aria-hidden="true" />
                  <div className={`bip-photo__status bip-photo__status--${phase}`}>{statusText}</div>
                  {phase === "preview" && (
                    <div className="bip-photo__actions">
                      <button type="button" className="bip-btn bip-btn--primary" onClick={capturePhoto}>
                        <Camera size={14} strokeWidth={2.5} /> Capture
                      </button>
                      <button type="button" className="bip-btn bip-btn--outline" onClick={stopCamera}>
                        <X size={14} strokeWidth={2.5} /> Cancel
                      </button>
                    </div>
                  )}
                  {!photo && phase === "idle" && (
                    <div className="bip-photo__actions">
                      <button type="button" className="bip-btn bip-btn--primary" onClick={startCamera}>
                        <Camera size={14} strokeWidth={2.5} /> Take photo
                      </button>
                    </div>
                  )}
                  {photo && phase === "idle" && (
                    <div className="bip-photo__thumb">
                      <img src={photo} alt="Captured ID photo" />
                      <button type="button" className="bip-btn bip-btn--outline" onClick={retake}>
                        <RefreshCcw size={14} strokeWidth={2.5} /> Retake
                      </button>
                    </div>
                  )}
                </div>
                {cameraError && <div className="bip-photo__error">{cameraError}</div>}
              </div>
            </div>

            <p className="bip-print-note">
              Print at 100% scale, without "fit to page." Align front and back before cutting. Keep ID files in authorized storage.
            </p>

            <Link to={`/admin/beneficiaries/${encodeURIComponent(beneficiaryId)}/qr`} className="bip-back-btn">
              Back to beneficiary QR
            </Link>
          </aside>
        </div>
      </div>

      <div className="bip-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>Secretary (Admin) role</span>
      </div>
    </>
  );
}
