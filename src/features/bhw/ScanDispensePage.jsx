import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Check,
  CheckCircle2,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import jsQR from "jsqr";
import { useEndpoint, sendApi } from "../../lib/useApi";
import { iotApi, IOT_MACHINE_ID } from "../../lib/iotApi";
import { Loading, ErrorState, EmptyState, InlineNotice } from "../../lib/ui";
import { fmtDate } from "./apiFormat";
import "../admin/DashboardPage.css";
import "./ScanDispense.css";

const SAFETY_CHECKS = [
  "Beneficiary name and ID match the person receiving care.",
  "Prescription is valid; allocation has not been released.",
  "Review any recorded allergy and escalate concerns before release.",
  "Correct medicine, strength, batch and expiry checked.",
  "Quantity and instructions explained to beneficiary.",
];

const STEPS = [
  { key: "identify", label: "Identify beneficiary" },
  { key: "review", label: "Review prescription" },
  { key: "confirm", label: "Confirm dispensing" },
];

const SCAN_WIDTH = 480;

// The prototype only has motor 1 wired, so every machine release uses it.
const DISPENSE_MOTOR_CHANNEL = 1;

// Free-text prescriptions are written by hand, so accept common spellings
// (e.g. the existing "Lozartan 5mg once daily" record).
const MEDICINE_ALIASES = {
  amlodipine: ["amlodipine", "amlodipin", "amlodpine"],
  metformin: ["metformin", "metformine", "metphormin"],
  losartan: ["losartan", "lozartan", "losartin"],
};

function medicineKey(name) {
  const n = String(name || "").toLowerCase();
  return Object.keys(MEDICINE_ALIASES).find((key) => n.includes(key)) || null;
}

function matchMedicine(text, medicines) {
  const t = String(text || "").toLowerCase();
  if (!t) return null;
  return (
    medicines.find((med) => {
      const key = medicineKey(med.name);
      return key && MEDICINE_ALIASES[key].some((alias) => t.includes(alias));
    }) || null
  );
}

export default function ScanDispensePage() {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState("");
  const [method, setMethod] = useState("IoT dispensing machine · TY-DM-01");

  // Camera / scan state
  const [phase, setPhase] = useState("idle"); // idle | starting | scanning | validating | success | error
  const [cameraError, setCameraError] = useState("");
  const [manualText, setManualText] = useState("");

  // Verified beneficiary from POST /qr/validate
  const [beneficiary, setBeneficiary] = useState(null);
  const [validateError, setValidateError] = useState("");
  const [selectedRxId, setSelectedRxId] = useState("");
  // Clinical records returned by /qr/validate. Used when the beneficiary has a
  // recorded prescription but no structured prescription row.
  const [scannedRecords, setScannedRecords] = useState([]);
  // Which recorded (free-text) prescription is selected for release.
  const [selectedRecordedId, setSelectedRecordedId] = useState("");
  // Prescription created from a recorded one, reused if the transaction is
  // retried so we never create duplicates.
  const [createdRxId, setCreatedRxId] = useState(null);

  // Dispensing submission
  const [submitting, setSubmitting] = useState(false);
  const [submitNotice, setSubmitNotice] = useState(null);

  // Active prescriptions for the verified beneficiary (server-sourced).
  const rxPath = beneficiary?.publicId
    ? `/prescriptions/active/${beneficiary.publicId}`
    : "";
  const {
    data: prescriptions,
    isLoading: rxLoading,
    error: rxError,
    refetch: refetchRx,
  } = useEndpoint(rxPath, (res) => res.prescriptions || [], {
    enabled: Boolean(rxPath),
  });

  const allowedMeds = ["amlodipine", "metformin", "losartan"];
  // `medicine` is serialized as a plain string ("Amlodipine 5 mg") by the
  // API, but accept an object too in case the shape changes.
  const rxList = (prescriptions || []).filter((p) => {
    const raw =
      typeof p.medicine === "string"
        ? p.medicine
        : p.medicine?.name || p.medicineName || "";
    const name = String(raw).toLowerCase();
    return allowedMeds.some((m) => name.includes(m));
  });
  const selectedRx =
    rxList.find((p) => String(p.id) === String(selectedRxId)) || rxList[0] || null;

  // Fallback for beneficiaries whose prescription exists only as free text on
  // a clinical record (e.g. "Losartan 5mg once daily").
  const recordedPrescriptions = (scannedRecords || []).filter(
    (r) => r.prescription && String(r.prescription).trim()
  );

  // Inventory is used to match a recorded prescription to a real medicine row;
  // the transaction endpoint requires a medicine id.
  const { data: inventoryItems } = useEndpoint(
    "/inventory",
    (res) => res.items || []
  );
  const medicines = inventoryItems || [];

  const selectedRecorded =
    rxList.length === 0
      ? recordedPrescriptions.find(
          (r) => String(r.id) === String(selectedRecordedId)
        ) ||
        recordedPrescriptions[0] ||
        null
      : null;
  const recordedMedicine = selectedRecorded
    ? matchMedicine(selectedRecorded.prescription, medicines)
    : null;
  // True when there is something valid to release (structured or recorded).
  const canDispense = Boolean(selectedRx) || Boolean(selectedRecorded && recordedMedicine);

  // Auto-select the first prescription once loaded.
  useEffect(() => {
    if (rxList.length > 0 && !selectedRxId) {
      setSelectedRxId(String(rxList[0].id));
    }
  }, [rxList, selectedRxId]);

  // Auto-select the first recorded prescription when there is no structured one.
  useEffect(() => {
    if (
      rxList.length === 0 &&
      recordedPrescriptions.length > 0 &&
      !selectedRecordedId
    ) {
      setSelectedRecordedId(String(recordedPrescriptions[0].id));
    }
  }, [rxList.length, recordedPrescriptions.length, selectedRecordedId]);

  // Prefill the quantity from the selected structured prescription. Only run
  // when the selection changes so the BHW can clear and retype the value.
  useEffect(() => {
    if (selectedRx) {
      setQuantity(String(selectedRx.remaining));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRx?.id]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const matchedRef = useRef(false);

  // Clean up camera + decode loop when leaving the page.
  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = streamRef.current;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    []
  );

  function stopDecoding() {
    matchedRef.current = true;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  /* ---------------- Camera handling ---------------- */

  async function startCamera() {
    if (streamRef.current) {
      // Camera already open — just restart the decode loop.
      matchedRef.current = false;
      setPhase("scanning");
      setCameraError("");
      rafRef.current = requestAnimationFrame(scanTick);
      return;
    }
    setPhase("starting");
    setCameraError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("getUserMedia unavailable");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      matchedRef.current = false;
      setPhase("scanning");
      rafRef.current = requestAnimationFrame(scanTick);
    } catch (err) {
      console.error("Camera error", err);
      setPhase("error");
      setCameraError(
        "Camera could not be opened. Allow camera access for this site " +
          "(works on localhost or HTTPS) and retry — or paste the QR payload below."
      );
    }
  }

  function scanTick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || matchedRef.current) return;

    if (video.readyState > 2 && video.videoWidth > 0) {
      const height = Math.max(
        1,
        Math.round((video.videoHeight / video.videoWidth) * SCAN_WIDTH)
      );
      if (canvas.width !== SCAN_WIDTH) canvas.width = SCAN_WIDTH;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, SCAN_WIDTH, height);
      const frame = ctx.getImageData(0, 0, SCAN_WIDTH, height);
      const code = jsQR(frame.data, SCAN_WIDTH, height, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        stopDecoding();
        validateQr(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(scanTick);
  }

  /* ---------------- Validation ---------------- */

  // Shared by the camera decode path and the manual paste path. The server
  // consumes the single-use token and returns the verified beneficiary.
  async function validateQr(payload) {
    const raw = (payload || "").trim();
    if (!raw) return;
    stopDecoding();
    setValidateError("");
    setSubmitNotice(null);
    setBeneficiary(null);
    setSelectedRxId("");
    setSelectedRecordedId("");
    setCreatedRxId(null);
    setQuantity("");
    setPhase("validating");

    const res = await sendApi("/qr/validate", { qrData: raw });
    if (!res.ok) {
      setPhase("error");
      setValidateError(res.error);
      return;
    }
    if (!res.data?.valid || !res.data?.beneficiary) {
      setPhase("error");
      setValidateError("The QR code could not be verified.");
      return;
    }
    setBeneficiary(res.data.beneficiary);
    setScannedRecords(res.data.clinicalRecords || []);
    setPhase("success");
  }

  function rescan() {
    setBeneficiary(null);
    setSelectedRxId("");
    setSelectedRecordedId("");
    setCreatedRxId(null);
    setScannedRecords([]);
    setValidateError("");
    setSubmitNotice(null);
    setManualText("");
    setQuantity("");
    matchedRef.current = false;
    if (streamRef.current) {
      setPhase("scanning");
      rafRef.current = requestAnimationFrame(scanTick);
    } else {
      setPhase("idle");
    }
  }

  function handleManualLookup(e) {
    e.preventDefault();
    validateQr(manualText);
  }

  /* ---------------- Dispensing ---------------- */

  const handleConfirm = async () => {
    if (submitting || !beneficiary) return;
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      setSubmitNotice({
        kind: "error",
        message: "Enter a quantity greater than 0.",
      });
      return;
    }

    // Resolve what to dispense. A structured prescription is preferred; when
    // only a recorded (free-text) prescription exists we create the structured
    // prescription row first so the transaction stays auditable.
    let medicineId = selectedRx?.medicineId ?? null;
    let prescriptionId = selectedRx?.id ?? null;
    let note = "";

    if (!selectedRx) {
      if (!selectedRecorded) {
        setSubmitNotice({
          kind: "error",
          message: "Select a recorded prescription to dispense against.",
        });
        return;
      }
      if (!recordedMedicine) {
        setSubmitNotice({
          kind: "error",
          message: `Could not match "${selectedRecorded.prescription}" to Amlodipine, Metformin or Losartan. Issue a structured prescription first.`,
        });
        return;
      }
      medicineId = recordedMedicine.id;
      note = `From recorded prescription ${selectedRecorded.code || selectedRecorded.id}`;
    }

    setSubmitting(true);
    setSubmitNotice(null);

    try {
      if (!prescriptionId) {
        if (createdRxId) {
          prescriptionId = createdRxId;
        } else {
          const rxRes = await sendApi("/prescriptions", {
            beneficiaryId: beneficiary.publicId,
            medicineId,
            dosage: selectedRecorded.prescription,
            quantity: qty,
            prescribedBy: selectedRecorded.recordedBy || "Recorded prescription",
            validUntil: null,
          });
          if (!rxRes.ok) {
            setSubmitNotice({
              kind: "error",
              message: `Could not create the prescription from the record: ${rxRes.error}`,
            });
            return;
          }
          prescriptionId = rxRes.data?.prescription?.id ?? null;
          setCreatedRxId(prescriptionId);
        }
      }

      const isIot = method.includes("TY-DM-01");
      const res = await sendApi("/transactions", {
        beneficiaryId: beneficiary.publicId,
        medicineId,
        quantity: qty,
        prescriptionId,
        machineCode: isIot ? "TY-DM-01" : undefined,
        note,
      });

      if (!res.ok) {
        setSubmitNotice({ kind: "error", message: res.error });
        return;
      }

      // Queue the physical release on motor 1 when the IoT machine is selected.
      let notice = {
        kind: "success",
        message: `Dispensing recorded for ${beneficiary.name}.`,
      };
      if (isIot) {
        try {
          await iotApi.sendCommand({
            machine_id: IOT_MACHINE_ID,
            command_type: "DISPENSE",
            motor_channel: DISPENSE_MOTOR_CHANNEL,
            parameters: "",
          });
          notice.message += ` Dispense command queued for motor ${DISPENSE_MOTOR_CHANNEL}.`;
        } catch (e) {
          notice = {
            kind: "error",
            message: `Dispensing recorded, but the machine command failed: ${e.message}`,
          };
        }
      }

      const transaction = res.data?.transaction;
      if (transaction?.id != null) {
        navigate(`/bhw/dispensing/${transaction.id}`, { state: { notice } });
      } else {
        setSubmitNotice(notice);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setQuantity("");
    setMethod("IoT dispensing machine · TY-DM-01");
    setSubmitNotice(null);
  };

  const statusText = {
    idle: "Camera off · start scanning a beneficiary QR",
    starting: "Opening camera…",
    scanning: "Live · point the QR card at the camera",
    validating: "Verifying QR token with the server…",
    success: `Verified · ${beneficiary?.name || "beneficiary"}`,
    error: "Scan failed",
  }[phase];

  const stepIndex = beneficiary ? (canDispense ? 2 : 1) : 0;

  return (
    <>
      {/* Header */}
      <div className="sd-header">
        <h1 className="sd-header__title">Scan ID &amp; confirm dispensing</h1>
        <p className="sd-header__subtitle">
          Webcam QR identification · Confirm dispensing for the verified
          beneficiary.
        </p>
      </div>

      {/* Steps */}
      <div className="sd-steps">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={
              "sd-step " +
              (i < stepIndex
                ? "sd-step--done"
                : i === stepIndex
                  ? "sd-step--active"
                  : "")
            }
          >
            <span className="sd-step__num">{i + 1}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="sd-info-banner">
        <strong>Live webcam scanning</strong>
        QR codes are decoded on-device with your webcam or device camera and
        verified against the server. Each QR code is single-use; a used or
        tampered code is rejected.
      </div>

      {/* ---------- LAYOUT ---------- */}
      <div className="sd-layout">
        {/* ============ LEFT COLUMN ============ */}
        <div>
          {/* QR identification */}
          <div className="sd-panel">
            <h2 className="sd-panel__title">QR-based identification</h2>

            <div className="sd-camera">
              <video
                ref={videoRef}
                className="sd-camera__video"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="sd-camera__canvas"
                hidden
                aria-hidden="true"
              />
              {phase === "scanning" && (
                <div className="sd-camera__frame">
                  <span className="sd-camera__corner sd-camera__corner--tl" />
                  <span className="sd-camera__corner sd-camera__corner--tr" />
                  <span className="sd-camera__corner sd-camera__corner--bl" />
                  <span className="sd-camera__corner sd-camera__corner--br" />
                  <span className="sd-camera__scanline" />
                </div>
              )}
              <div className={`sd-camera__status sd-camera__status--${phase}`}>
                {statusText}
              </div>
            </div>

            {(phase === "idle" || phase === "error") && (
              <button
                className="sd-scan-btn sd-scan-btn--primary"
                type="button"
                onClick={startCamera}
              >
                <Camera size={14} strokeWidth={2.5} />
                {phase === "error" ? "Retry camera" : "Start camera scan"}
              </button>
            )}

            {phase === "validating" && <Loading label="Verifying QR token…" />}

            {phase === "success" && (
              <>
                <div className="sd-result">
                  <Check size={13} strokeWidth={3} />
                  <span>{beneficiary?.name} verified</span>
                  <span className="sd-result__id">· {beneficiary?.publicId}</span>
                </div>
                <button
                  className="sd-scan-btn"
                  type="button"
                  onClick={rescan}
                  style={{ marginTop: 10 }}
                >
                  <RefreshCcw size={14} />
                  Scan another ID
                </button>
              </>
            )}

            {cameraError && (
              <div className="sd-manual__error">{cameraError}</div>
            )}
            {validateError && (
              <div style={{ marginTop: 10 }}>
                <InlineNotice kind="error">{validateError}</InlineNotice>
              </div>
            )}

            {/* Manual fallback */}
            <div className="sd-manual">
              <p className="sd-manual__label">
                Or paste the QR payload if the camera cannot start
              </p>
              <form className="sd-manual__row" onSubmit={handleManualLookup}>
                <input
                  type="text"
                  className="sd-manual__input"
                  placeholder='{"iv":…,"data":…}'
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                />
                <button className="sd-manual__btn" type="submit">
                  <Search size={13} />
                  Verify
                </button>
              </form>
            </div>
          </div>

          {/* Identified beneficiary */}
          <div className="sd-panel">
            <h2 className="sd-panel__title">Beneficiary information</h2>

            {beneficiary ? (
              <>
                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Name</p>
                  <p className="sd-beneficiary__value">{beneficiary.name}</p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Beneficiary ID</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.publicId}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Date of birth</p>
                  <p className="sd-beneficiary__value">
                    {fmtDate(beneficiary.birthDate) || "—"}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Sex</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.sex || "—"}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Address</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.address || "—"}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Phone</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.phone || "—"}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Program</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.program || "—"}
                  </p>
                </div>

                <div className="sd-beneficiary__field">
                  <p className="sd-beneficiary__label">Status</p>
                  <p className="sd-beneficiary__value">
                    {beneficiary.status || "—"}
                  </p>
                </div>

                <span className="sd-beneficiary__pill">
                  • Verified beneficiary
                </span>

                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="sd-btn sd-btn--primary"
                    style={{ flex: 1 }}
                    disabled={!canDispense || submitting}
                    onClick={() => {
                      // Move the BHW to the review/confirm step.
                      document
                        .querySelector(".sd-rx-panel")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      document.querySelector(".sd-rx-input")?.focus();
                    }}
                  >
                    Dispense medicine
                  </button>
                  <button
                    type="button"
                    className="sd-btn sd-btn--outline"
                    style={{ flex: 1 }}
                    onClick={rescan}
                  >
                    <X size={14} strokeWidth={2.5} /> Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="sd-beneficiary__empty">
                <strong>Waiting for scan</strong>
                Point a QR card at the camera or paste the QR payload above.
              </div>
            )}
          </div>
        </div>

        {/* ============ RIGHT COLUMN ============ */}
        <div>
          {/* Review authorized medicine */}
          <div className="sd-rx-panel">
            <div className="sd-rx-header">
              <div>
                <h2 className="sd-rx-header__title">
                  Review authorized medicine
                </h2>
                <p className="sd-rx-header__sub">
                  Verify the prescription before release.
                </p>
              </div>
              {selectedRx && (
                <span className="sd-rx-valid">• Active prescription</span>
              )}
            </div>

            {!beneficiary ? (
              <p className="sd-rx-header__sub">
                Verify a beneficiary QR to load the authorized medicines.
              </p>
            ) : rxLoading && !prescriptions ? (
              <Loading label="Loading prescriptions…" />
            ) : rxError ? (
              <ErrorState message={rxError} onRetry={refetchRx} />
            ) : rxList.length === 0 && recordedPrescriptions.length === 0 ? (
              <EmptyState
                title="No prescription on file"
                message="This beneficiary has no authorized medicine or recorded prescription to review."
              />
            ) : rxList.length === 0 ? (
              <>
                <div className="sd-rx-recorded-note">
                  No structured prescription is on file. Select the recorded
                  prescription to release against — confirming will create a
                  structured prescription from it.
                </div>
                {recordedPrescriptions.map((r) => {
                  const isSelected =
                    String(r.id) === String(selectedRecorded?.id);
                  const med = matchMedicine(r.prescription, medicines);
                  return (
                    <table
                      className={`sd-rx-table ${
                        isSelected ? "sd-rx-table--selected" : ""
                      }`}
                      key={r.id}
                      onClick={() => setSelectedRecordedId(String(r.id))}
                    >
                      <tbody>
                        <tr>
                          <th scope="row">
                            <input
                              type="radio"
                              name="sd-recorded-choice"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedRecordedId(String(r.id))
                              }
                              aria-label={`Select recorded prescription ${
                                r.code || r.id
                              }`}
                              style={{ marginRight: 8 }}
                            />
                            Prescription (recorded)
                          </th>
                          <td className="sd-rx-table__med">
                            {r.prescription}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">Matched medicine</th>
                          <td>
                            {med ? (
                              <>
                                {med.name} · {med.slot} · {med.stock}{" "}
                                {med.unit} in stock
                              </>
                            ) : (
                              <span className="sd-rx-recorded-error">
                                No match — issue a structured prescription
                                first.
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <th scope="row">Record</th>
                          <td>{r.code || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Type</th>
                          <td>{r.type || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Date recorded</th>
                          <td>{fmtDate(r.recordedAt) || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Reason for visit</th>
                          <td>{r.reasonForVisit || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Symptoms</th>
                          <td>{r.symptoms || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Medical history</th>
                          <td>{r.medicalHistory || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Notes</th>
                          <td>{r.notes || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Recorded by</th>
                          <td>{r.recordedBy || "—"}</td>
                        </tr>
                        <tr>
                          <th scope="row">Status</th>
                          <td>{r.status || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })}

                {selectedRecorded && recordedMedicine ? (
                  <>
                    <div className="sd-rx-inputs">
                      <div>
                        <label className="sd-rx-input-label">
                          Quantity to dispense <span className="req">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={recordedMedicine.stock}
                          className="sd-rx-input"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="e.g. 30"
                        />
                      </div>
                      <div>
                        <label className="sd-rx-input-label">
                          Release method
                        </label>
                        <select
                          className="sd-rx-select"
                          value={method}
                          onChange={(e) => setMethod(e.target.value)}
                        >
                          <option>IoT dispensing machine · TY-DM-01</option>
                          <option>Manual · Health center</option>
                        </select>
                      </div>
                    </div>
                    <p className="sd-rx-header__sub" style={{ marginTop: 10 }}>
                      {method.includes("TY-DM-01")
                        ? "Confirming queues a DISPENSE command for motor 1."
                        : "Confirming records the transaction only."}
                    </p>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {/* All authorized medicines, one row each */}
                <table className="sd-rx-table">
                  <thead>
                    <tr>
                      <th aria-label="Select"></th>
                      <th>Medicine</th>
                      <th>Prescription</th>
                      <th>Directions</th>
                      <th>Authorized</th>
                      <th>Remaining</th>
                      <th>Valid until</th>
                      <th>Prescriber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxList.map((p) => {
                      const isSelected =
                        String(p.id) === String(selectedRx?.id);
                      return (
                        <tr
                          key={p.id}
                          className={
                            isSelected ? "sd-rx-table__row--selected" : ""
                          }
                          onClick={() => setSelectedRxId(String(p.id))}
                        >
                          <td>
                            <input
                              type="radio"
                              name="sd-rx-choice"
                              checked={isSelected}
                              onChange={() => setSelectedRxId(String(p.id))}
                              aria-label={`Select ${p.medicine}`}
                            />
                          </td>
                          <td className="sd-rx-table__med">{p.medicine}</td>
                          <td>{p.code}</td>
                          <td>{p.dosage || "—"}</td>
                          <td>{p.quantity}</td>
                          <td>{p.remaining}</td>
                          <td>{fmtDate(p.validUntil) || "—"}</td>
                          <td>{p.prescribedBy || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Inputs: qty + method */}
                <div className="sd-rx-inputs">
                  <div>
                    <label className="sd-rx-input-label">
                      Quantity to dispense (per prescription) <span className="req">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedRx.remaining}
                      className="sd-rx-input"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="sd-rx-input-label">Release method</label>
                    <select
                      className="sd-rx-select"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <option>IoT dispensing machine · TY-DM-01</option>
                      <option>Manual · Health center</option>
                    </select>
                    <p
                      className="sd-rx-header__sub"
                      style={{ marginTop: 6, marginBottom: 0 }}
                    >
                      {method.includes("TY-DM-01")
                        ? "Queues a DISPENSE command for motor 1."
                        : "Records the transaction only."}
                    </p>
                  </div>
                </div>

                {/* Remaining after */}
                <div
                  className="sd-rx-grid"
                  style={{ marginTop: 18, marginBottom: 0 }}
                >
                  <div className="sd-rx-field">
                    <span className="sd-rx-field__label">
                      Remaining after release
                    </span>
                    <span className="sd-rx-field__value">
                      {Math.max(
                        selectedRx.remaining - (parseInt(quantity, 10) || 0),
                        0
                      )}{" "}
                      units
                    </span>
                  </div>
                  <div className="sd-rx-field">
                    <span className="sd-rx-field__label">
                      Selected prescription
                    </span>
                    <span className="sd-rx-field__value">
                      {selectedRx.code}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Safety checks */}
          <div className="sd-safety">
            <h2 className="sd-safety__title">Safety checks</h2>
            <p className="sd-safety__sub">
              Staff must verify each item before release.
            </p>

            {SAFETY_CHECKS.map((c, i) => (
              <div className="sd-check-item" key={i}>
                <CheckCircle2
                  size={14}
                  strokeWidth={2.5}
                  className="sd-check-item__icon"
                />
                <span>{c}</span>
              </div>
            ))}

            {/* Feedback */}
            {submitNotice ? (
              <div style={{ marginTop: 12 }}>
                <InlineNotice kind={submitNotice.kind}>
                  {submitNotice.message}
                </InlineNotice>
              </div>
            ) : null}

            {/* Actions */}
            <div className="sd-actions">
              <button
                type="button"
                className="sd-btn sd-btn--primary"
                onClick={handleConfirm}
                disabled={
                  submitting ||
                  !beneficiary ||
                  !canDispense ||
                  !(parseInt(quantity, 10) > 0)
                }
              >
                <Check size={15} strokeWidth={2.5} />
                {submitting ? "Recording…" : "Confirm medicine dispensing"}
              </button>
              <button
                type="button"
                className="sd-btn sd-btn--outline"
                onClick={handleCancel}
                disabled={submitting}
              >
                <X size={15} strokeWidth={2.5} />
                Cancel release
              </button>
            </div>

            <p className="sd-actions-note">
              Confirmation records staff, prescription, quantity and time. It
              does not authorize a new prescription.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- PAGE FOOTER ---------- */}
      <div className="sd-page-footer">
        <span>QR-MedSecure · Barangay 354 Tayuman, Manila</span>
        <span>BHW workspace</span>
      </div>
    </>
  );
}
