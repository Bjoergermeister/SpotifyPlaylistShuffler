const baseURL = "http://localhost:8888/";

class Api {

  static async shuffle(button)
  {
    const url = baseURL + `shuffle/${button.dataset.id}`;
    console.log(url);
    const options = getRequestOptions("GET", null);

    const shuffledPlaylist = await fetch(url, options)
    .then(async (result) => {
      if (result.status !== 200) return;
      return await result.json();
    })
    .catch((error) => {
      console.log(error)
    });

    // Create a copy of the table
    const tracks = document.getElementById("tracks");
    const tracksClone = tracks.cloneNode(true);
    const tableRows = tracksClone.querySelectorAll("tbody tr");

    // Update content of the copy
    shuffledPlaylist.forEach((track, index) => {
      tableRows[index].children[1].children[0].src = track.album.images.pop().url;
      tableRows[index].children[2].innerText = track.name;
    });

    // Replace table with its copy (in order to minimize DOM manipulations)
    tracks.replaceWith(tracksClone);
  }

}

/* Helper functions */
function getRequestOptions(method, body) {
  return {
    method: method,
    credentials: "same-origin"
  };
}