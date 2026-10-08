'use strict';
for (const form of document.querySelectorAll('.busyform')) {
  form.addEventListener('submit',()=>{
    form.querySelector('.busytext').hidden=false;
    const button=form.querySelector('button');button.disabled=true;button.textContent='Zakládám web…';
  });
}
