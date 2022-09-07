let playlistId = undefined;
let warningModal = undefined;
let hideWarning = false;

window.onload = () => {
  const url = window.location.href;
  if (url.includes("/playlist") === false) return;

  // Extract playlist id from url
  const lastUrlPartsStart = url.lastIndexOf("/") + 1; // + 1 because we don't want the '/'
  playlistId = url.substring(lastUrlPartsStart, url.length);

  warningModal = document.getElementById("warningModal");
};

function shuffle() {
  // Check if warning modal should be displayed
  if (warningModal === null || hideWarning) {
    Api.shuffle();
    return;
  }

  warningModal.style.display = "block";
}

function hideWarningModal() {
  warningModal.style.display = "none";
}

function onCheckboxChanged(checkbox) {
  console.log(checkbox);
  hideWarning = checkbox.checked;
}
