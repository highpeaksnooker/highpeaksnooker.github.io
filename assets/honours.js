(() => {
  const select = document.getElementById('honoursSelect');
  const sections = [...document.querySelectorAll('section.honour')];
  function show(id) {
    const active = sections.find(section => section.id === id) || sections[0];
    sections.forEach(section => { section.hidden = section !== active; });
    select.value = active.id;
  }
  select.addEventListener('change', () => {
    show(select.value);
    history.replaceState(null, '', '#' + select.value);
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  show(location.hash.slice(1));
})();
