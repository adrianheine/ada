window.addEventListener('click', function(e) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.button != 0) return;
  if (["show", "hide"].indexOf(e.target.className) == -1) return;
  var isShow = e.target.className == "show"
  var toggleable = isShow ? e.target.parentNode : e.target.parentNode.parentNode;
  if (!toggleable.classList.contains("toggleable")) return;
  var match = e.target.getAttribute("href").match(/^#(show|hide)__([\w_]+)$/)
  if (!match) return;

  // If we have a hide|show hash, it overrides the class, so we should just change the hash
  if (isShow == toggleable.classList.contains("toggleable_show")) return;

  toggleable.classList[isShow ? "add" : "remove"]("toggleable_show")
  e.preventDefault()
})
