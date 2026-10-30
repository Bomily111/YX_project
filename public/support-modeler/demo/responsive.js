const button = document.createElement('button')
button.type = 'button'
button.className = 'support-panel-toggle'
button.setAttribute('aria-controls', 'support-parameters')
document.querySelector('.side')?.setAttribute('id', 'support-parameters')

function updateButton() {
  const open = document.body.classList.contains('support-panel-open')
  button.textContent = open ? '关闭参数' : '参数与构件 ☰'
  button.setAttribute('aria-expanded', String(open))
}

button.addEventListener('click', () => {
  document.body.classList.toggle('support-panel-open')
  updateButton()
})
document.body.append(button)
updateButton()
