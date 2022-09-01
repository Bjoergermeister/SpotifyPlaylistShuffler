let userMenuIsOpen = false;

function expandUserMenu(){
    const arrow = document.querySelector("#user span.arrow");
    const rotation = (userMenuIsOpen) ? "-90deg" : "90deg";

    arrow.style.transform = `translateX(-5px) rotate(${rotation})`;
    userMenuIsOpen = !userMenuIsOpen;
}