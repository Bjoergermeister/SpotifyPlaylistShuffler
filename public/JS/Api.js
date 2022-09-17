const baseURL = "http://localhost:8888/";

class Api {
  static async shuffle() {
    const url = baseURL + `shuffle/${playlistId}?warning_accepted=${!warningAccepted}`;
    const options = getRequestOptions("GET", null);

    const response = await fetch(url, options);
    if (response.status !== 200) return;

    const shuffledPlaylist = await response.json();

    // Create a copy of the table
    const tracks = document.getElementById("tracks");
    const tracksClone = tracks.cloneNode(true);
    const tableRows = tracksClone.querySelectorAll("tbody tr");

    // Update content of the copy
    shuffledPlaylist.tracks.forEach((track, index) => {
      tableRows[index].children[1].children[0].src = track.album.images.pop().url;
      tableRows[index].children[2].innerText = track.name;
    });

    // Replace table with its copy (in order to minimize DOM manipulations)
    tracks.replaceWith(tracksClone);

    // Replace playlist image
    const playlistImage = document.querySelector("header img");
    playlistImage.src = `${shuffledPlaylist.url}`;
  }
}

/* Helper functions */
function getRequestOptions(method, body) {
  return {
    method: method,
    credentials: "same-origin",
  };
}
