const infoArea = document.querySelector(".info");

// Neofetch like info
const info = {
  User: "SSK",
  Host: "archBTW",
  Uptime: "21 years",
  Shell: "zsh",
  Editor: "Neovim",
  OS: "Arch Linux",
  Hobby: "Tinkering with Linux & custom setups",
  Quote: "I use arch BTW 🐧",
};

// Loop through the object and create elements
for (const [key, value] of Object.entries(info)) {
  const k = document.createElement("span");
  k.classList.add("key");
  k.innerHTML = key;

  const seprator = document.createElement("span");
  seprator.innerHTML = " : ";
  seprator.classList.add("key");
  seprator.classList.add("seprator");

  const v = document.createElement("span");
  v.classList.add("value");
  v.innerHTML = value;

  const infoRow = document.createElement("div");
  infoRow.classList.add("info-row");

  infoRow.appendChild(k);
  infoRow.appendChild(seprator);
  infoRow.appendChild(v);

  infoArea.appendChild(infoRow);
}
