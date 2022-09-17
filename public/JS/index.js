let playlistId = undefined;
let warningModal = undefined;
let shuffleAnimationContainer = undefined;
let warningAccepted = false;

window.onload = () => {
  const url = window.location.href;
  if (url.includes("/playlist") === false) return;

  // Extract playlist id from url
  const lastUrlPartsStart = url.lastIndexOf("/") + 1; // + 1 because we don't want the '/'
  playlistId = url.substring(lastUrlPartsStart, url.length);

  shuffleAnimationContainer = document.getElementById("shuffleAnimationContainer");
  warningModal = document.getElementById("warningModal");
  warningAccepted = warningModal === undefined;
};

async function shuffle() {
  if (warningAccepted === false) {
    warningModal.style.display = "block";
    return;
  }

  shuffleAnimationContainer.style.display = "block";
  await Api.shuffle();
  shuffleAnimationContainer.style.display = "none";
}

/*** Event Handlers ***/
function onCheckboxChanged(checkbox) {
  hideWarning = checkbox.checked;
}

function onWarningAccepted() {
  warningAccepted = true;
  warningModal.style.display = "none";
  shuffle();
}

function onModalCancelled() {
  warningModal.style.display = "none";
}
