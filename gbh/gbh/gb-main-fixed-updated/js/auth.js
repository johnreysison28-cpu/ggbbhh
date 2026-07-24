// ═══════════════════════════════════════════════
// auth.js — Register, Login, Logout, Session
// ═══════════════════════════════════════════════

function doRegister() {
  const name    = val('regName').trim();
  const email   = val('regEmail').trim().toLowerCase();
  const dob     = val('regDob');
  const phone   = val('regPhone').trim();
  const pass    = val('regPass');
  const pass2   = val('regPass2');
  const idType  = val('regIdType');
  const idNumber = val('regIdNumber').trim();

  const err = document.getElementById('regError');
  const suc = document.getElementById('regSuccess');
  err.style.display = 'none';
  suc.style.display = 'none';

  if (!name || !email || !dob || !phone || !pass || !idType || !idNumber)
    return showErr(err, 'Please fill in all required fields.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return showErr(err, 'Invalid email address.');
  if (!/^09\d{9}$/.test(phone.replace(/\s|-/g, '')))
    return showErr(err, 'Enter a valid PH mobile number, e.g. 09XXXXXXXXX.');
  const age = _calcAge(dob);
  if (age === null || age < 18)
    return showErr(err, 'You must be at least 18 years old to register.');
  if (pass.length < 6)
    return showErr(err, 'Password must be at least 6 characters.');
  if (pass !== pass2)
    return showErr(err, 'Passwords do not match.');

  // Fields look good — before actually creating the account, require the
  // GCash-style identity verification: valid ID capture + selfie scan.
  document.getElementById('kycIdTypeLabel').textContent = idType;
  openFaceScanModal();
}

function _calcAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Does the actual account creation. Called once the person has completed
// (or explicitly skipped, if allowed) the face scan step.
async function finishRegistration() {
  const name    = val('regName').trim();
  const email   = val('regEmail').trim().toLowerCase();
  const pass    = val('regPass');
  const loc     = val('regLocation').trim();
  const dob     = val('regDob');
  const phone   = val('regPhone').trim();
  const idType  = val('regIdType');
  const idNumber = val('regIdNumber').trim();

  const err = document.getElementById('regError');
  const suc = document.getElementById('regSuccess');

  try {
    const { user, kycUploadFailed } = await apiPost('/auth/register', {
      name, email, password: pass, location: loc,
      dob, phone, idType, idNumber,
      avatar: state.avatarDataURL || null,
      faceScan: state.faceScanDataURL || null,
      idPhoto: state.idPhotoDataURL || null,
    });
    state.currentUser = user;
    closeFaceScanModal();
    suc.style.display = 'block';
    if (kycUploadFailed) {
      suc.textContent = '⚠️ Account created, but your ID/selfie photos could not be saved. Please go to your profile and resubmit your verification. Redirecting...';
    } else {
      suc.textContent = '✅ Account created! Your ID verification is now pending admin review. Redirecting...';
    }
    setTimeout(() => { window.location.href = 'index.html'; }, 2800);
  } catch (e) {
    let msg = e.message || 'Registration failed.';
    if (msg.includes('email-already-in-use')) msg = 'An account with this email already exists.';
    closeFaceScanModal();
    showErr(err, msg);
  }
}

// ── Image compression helper ────────────────────
// Both the ID photo and the selfie end up base64-encoded inside a single
// Firestore document (faceVerifications/{uid}), which has a hard 1 MiB
// size limit. A raw phone-camera photo can be several MB on its own, so
// EVERY photo — captured or uploaded — must be downscaled/recompressed
// before it's stored, or the Firestore write silently fails and no image
// ever gets saved (this is what caused the broken images in admin.html).
function _compressDataURL(dataURL, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not process image.'));
    img.src = dataURL;
  });
}

// ── Identity Verification (GCash-style KYC) ────
// Step 1: capture/upload a photo of the user's valid ID.
// Step 2: capture a selfie via the device camera (liveness-style check).
// Step 3: review both captures before the account is actually created.
// This is a lightweight capture flow — it does not perform any real
// biometric matching or OCR itself, only collects the artifacts.
let _faceScanStream = null;
let _idScanStream = null;

function _faceScanShowStep(step) {
  document.getElementById('faceScanIdleActions').style.display   = step === 'idle'   ? 'block' : 'none';
  document.getElementById('faceScanLiveActions').style.display   = step === 'live'   ? 'flex'  : 'none';
  document.getElementById('faceScanReviewActions').style.display = step === 'review' ? 'flex'  : 'none';
}

function _idScanShowStep(step) {
  document.getElementById('idScanIdleActions').style.display   = step === 'idle'   ? 'flex' : 'none';
  document.getElementById('idScanLiveActions').style.display   = step === 'live'   ? 'block'  : 'none';
  document.getElementById('idScanReviewActions').style.display = step === 'review' ? 'flex'  : 'none';
}

function _setKycStepDots(activeStep) {
  const order = ['Id', 'Selfie', 'Review'];
  order.forEach((s, i) => {
    const dot = document.getElementById('kycStepDot' + s);
    dot.classList.remove('active', 'done');
    if (i < activeStep) dot.classList.add('done');
    else if (i === activeStep) dot.classList.add('active');
  });
}

function _showKycPanel(panel) {
  document.getElementById('kycIdStep').style.display     = panel === 'id'     ? 'block' : 'none';
  document.getElementById('kycSelfieStep').style.display = panel === 'selfie' ? 'block' : 'none';
  document.getElementById('kycReviewStep').style.display = panel === 'review' ? 'block' : 'none';
  _setKycStepDots(panel === 'id' ? 0 : panel === 'selfie' ? 1 : 2);
}

function openFaceScanModal() {
  const overlay = document.getElementById('faceScanOverlay');
  const errBox  = document.getElementById('faceScanError');
  errBox.style.display = 'none';

  // Reset ID step
  document.getElementById('idScanVideo').style.display = 'none';
  document.getElementById('idScanPhoto').style.display = 'none';
  document.getElementById('idScanPlaceholder').style.display = 'block';
  _idScanShowStep('idle');
  state.idPhotoDataURL = null;

  // Reset selfie step
  document.getElementById('faceScanVideo').style.display = 'none';
  document.getElementById('faceScanPhoto').style.display = 'none';
  _faceScanShowStep('idle');
  state.faceScanDataURL = null;

  _showKycPanel('id');
  overlay.classList.add('open');
}

function closeFaceScanModal() {
  const overlay = document.getElementById('faceScanOverlay');
  overlay.classList.remove('open');
  if (_faceScanStream) {
    _faceScanStream.getTracks().forEach(t => t.stop());
    _faceScanStream = null;
  }
  if (_idScanStream) {
    _idScanStream.getTracks().forEach(t => t.stop());
    _idScanStream = null;
  }
}

// ── Step 1: Valid ID capture ───────────────────
async function startIdScan() {
  const errBox = document.getElementById('faceScanError');
  errBox.style.display = 'none';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return showErr(errBox, 'Camera access is not supported on this device/browser. Use "Upload File" instead.');
  }

  try {
    _idScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }, audio: false,
    });
    const video = document.getElementById('idScanVideo');
    video.srcObject = _idScanStream;
    video.style.display = 'block';
    document.getElementById('idScanPhoto').style.display = 'none';
    document.getElementById('idScanPlaceholder').style.display = 'none';
    _idScanShowStep('live');
  } catch (e) {
    let msg = 'Could not access your camera. Please allow camera permission, or use "Upload File" instead.';
    if (e && e.name === 'NotFoundError') msg = 'No camera was found on this device. Use "Upload File" instead.';
    showErr(errBox, msg);
  }
}

function captureIdPhoto() {
  const video  = document.getElementById('idScanVideo');
  const canvas = document.getElementById('idScanCanvas');
  const photo  = document.getElementById('idScanPhoto');

  // Cap resolution — keeps the doc under Firestore's 1MiB limit even on
  // webcams/phones that stream at 1080p+.
  const MAX_DIM = 1000;
  let w = video.videoWidth  || 640;
  let h = video.videoHeight || 400;
  if (w > MAX_DIM || h > MAX_DIM) {
    if (w >= h) { h = Math.round(h * (MAX_DIM / w)); w = MAX_DIM; }
    else { w = Math.round(w * (MAX_DIM / h)); h = MAX_DIM; }
  }
  canvas.width  = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(video, 0, 0, w, h);

  state.idPhotoDataURL = canvas.toDataURL('image/jpeg', 0.75);
  photo.src = state.idPhotoDataURL;
  photo.style.display = 'block';
  video.style.display = 'none';

  if (_idScanStream) {
    _idScanStream.getTracks().forEach(t => t.stop());
    _idScanStream = null;
  }
  _idScanShowStep('review');
}

function handleIdPhotoUpload(input) {
  if (!input.files[0]) return;
  const errBox = document.getElementById('faceScanError');
  errBox.style.display = 'none';
  const r = new FileReader();
  r.onload = async e => {
    try {
      // Raw phone-camera uploads can be several MB — compress before storing
      // or the Firestore write for faceVerifications silently fails.
      state.idPhotoDataURL = await _compressDataURL(e.target.result, 1000, 0.75);
    } catch (_) {
      state.idPhotoDataURL = e.target.result; // fall back to original if compression fails
    }
    const photo = document.getElementById('idScanPhoto');
    photo.src = state.idPhotoDataURL;
    photo.style.display = 'block';
    document.getElementById('idScanVideo').style.display = 'none';
    document.getElementById('idScanPlaceholder').style.display = 'none';
    _idScanShowStep('review');
  };
  r.readAsDataURL(input.files[0]);
}

function retakeIdPhoto() {
  state.idPhotoDataURL = null;
  document.getElementById('idScanPhoto').style.display = 'none';
  document.getElementById('idScanPlaceholder').style.display = 'block';
  _idScanShowStep('idle');
}

function confirmIdPhoto() {
  if (!state.idPhotoDataURL) {
    return showErr(document.getElementById('faceScanError'), 'Please capture or upload a photo of your ID first.');
  }
  document.getElementById('faceScanError').style.display = 'none';
  _showKycPanel('selfie');
}

async function startFaceScan() {
  const errBox = document.getElementById('faceScanError');
  errBox.style.display = 'none';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return showErr(errBox, 'Camera access is not supported on this device/browser.');
  }

  try {
    _faceScanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' }, audio: false,
    });
    const video = document.getElementById('faceScanVideo');
    video.srcObject = video.srcObject || _faceScanStream;
    video.srcObject = _faceScanStream;
    video.style.display = 'block';
    document.getElementById('faceScanPhoto').style.display = 'none';
    _faceScanShowStep('live');
  } catch (e) {
    let msg = 'Could not access your camera. Please allow camera permission and try again.';
    if (e && e.name === 'NotFoundError') msg = 'No camera was found on this device.';
    showErr(errBox, msg);
  }
}

function captureFacePhoto() {
  const video  = document.getElementById('faceScanVideo');
  const canvas = document.getElementById('faceScanCanvas');
  const photo  = document.getElementById('faceScanPhoto');

  const cropSize = Math.min(video.videoWidth, video.videoHeight) || 320;
  const size = Math.min(cropSize, 640); // cap output — keeps doc size in check
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const sx  = (video.videoWidth  - cropSize) / 2;
  const sy  = (video.videoHeight - cropSize) / 2;
  ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, size, size);

  state.faceScanDataURL = canvas.toDataURL('image/jpeg', 0.8);
  photo.src = state.faceScanDataURL;
  photo.style.display = 'block';
  video.style.display = 'none';

  if (_faceScanStream) {
    _faceScanStream.getTracks().forEach(t => t.stop());
    _faceScanStream = null;
  }
  _faceScanShowStep('review');
}

function retakeFacePhoto() {
  state.faceScanDataURL = null;
  document.getElementById('faceScanPhoto').style.display = 'none';
  _faceScanShowStep('idle');
}

function confirmFacePhoto() {
  if (!state.faceScanDataURL) {
    return showErr(document.getElementById('faceScanError'), 'Please capture a photo first.');
  }
  document.getElementById('faceScanError').style.display = 'none';
  _populateKycReview();
  _showKycPanel('review');
}

function backToSelfieStep() {
  _showKycPanel('selfie');
}

function _populateKycReview() {
  document.getElementById('kycReviewIdImg').src = state.idPhotoDataURL || '';
  document.getElementById('kycReviewSelfieImg').src = state.faceScanDataURL || '';

  const idType   = val('regIdType');
  const idNumber = val('regIdNumber').trim();
  const dob      = val('regDob');
  const phone    = val('regPhone').trim();

  document.getElementById('kycReviewSummary').innerHTML = `
    <div><b>Name:</b> ${val('regName').trim()}</div>
    <div><b>Date of Birth:</b> ${dob}</div>
    <div><b>Mobile Number:</b> ${phone}</div>
    <div><b>ID Type:</b> ${idType}</div>
    <div><b>ID Number:</b> ${idNumber}</div>
  `;
}

async function doLogin() {
  const email = val('loginEmail').trim().toLowerCase();
  const pass  = val('loginPass');
  const err   = document.getElementById('loginError');
  err.style.display = 'none';

  if (!email || !pass) return showErr(err, 'Please fill in all fields.');

  try {
    const { user } = await apiPost('/auth/login', { email, password: pass });
    state.currentUser = user;
    updateNavUser();
    showToast('Welcome back, ' + user.name + '! 👋');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  } catch (e) {
    let msg = e.message || 'Login failed.';
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
      msg = 'Invalid email or password.';
    showErr(err, msg);
  }
}

async function logout() {
  const uid = state.currentUser && (state.currentUser.uid || state.currentUser.id);
  try { await apiPost('/auth/logout'); } catch (_) {}
  if (uid && typeof setPresenceOffline === 'function') setPresenceOffline(uid);
  state.currentUser = null;
  updateNavUser();
  showToast('Signed out successfully');
  setTimeout(() => { window.location.href = 'index.html'; }, 800);
}

function requireLoginRedirect() {
  if (!state.currentUser) {
    showToast('Please sign in first', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return false;
  }
  return true;
}

function previewAvatar(input) {
  if (!input.files[0]) return;
  const r = new FileReader();
  r.onload = e => {
    state.avatarDataURL = e.target.result;
    const preview = document.getElementById('regAvatarPreview');
    if (preview) preview.innerHTML = `<img src="${e.target.result}" alt="">`;
  };
  r.readAsDataURL(input.files[0]);
}

// ── Firebase Password Reset (real email!) ─────
async function sendResetCode() {
  const email = document.getElementById('fgEmail').value.trim().toLowerCase();
  const err   = document.getElementById('fgError1');
  err.style.display = 'none';

  if (!email) return showErr(err, 'Please enter your email address.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr(err, 'Invalid email address.');

  try {
    await firebase.auth().sendPasswordResetEmail(email);
    // Show success step
    document.getElementById('fgEmailDisplay').textContent = email;
    document.getElementById('fgStep1').style.display = 'none';
    document.getElementById('fgStep2').style.display = 'block';
  } catch (e) {
    let msg = e.message || 'Could not send reset email.';
    if (msg.includes('user-not-found')) msg = 'No account found with this email address.';
    showErr(err, msg);
  }
}

function setLoggedIn(user) {
  state.currentUser = user;
  updateNavUser();
}
