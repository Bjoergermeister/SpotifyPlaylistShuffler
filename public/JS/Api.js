const baseURL = "http://localhost:8888/";

class Api {

  static async shuffle(button)
  {
    const url = baseURL + `shuffle/${button.dataset.id}`;
    const options = getRequestOptions("GET", null);

    const shuffledPlaylist = await fetch(url, options)
    .then(async (result) => {
      if (result.status !== 200) return;
      return await result.json();
    })
    .catch((error) => {
      console.log(error)
    });

    const tracks = document.getElementById("tracks");
    tracks.innerHTML = "";

    shuffledPlaylist.forEach((track, index) => {
      const li = document.createElement("LI");
      li.innerHTML = `${index + 1}. ${track.name}`;
      tracks.appendChild(li);
    });
  }

}

/* Helper functions */
function getRequestOptions(method, body) {
  return {
    method: method,
    credentials: "same-origin"
  };
}