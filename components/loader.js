window.sunbookComponents = window.sunbookComponents || {};

function loadComponent(targetSelector, componentName) {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  if (window.sunbookComponents[componentName]) {
    target.innerHTML = window.sunbookComponents[componentName];
    return;
  }

  const script = document.createElement('script');
  script.src = `components/${componentName}.js`;
  script.onload = () => {
    if (window.sunbookComponents[componentName]) {
      target.innerHTML = window.sunbookComponents[componentName];
    }
  };
  document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
  loadComponent('[data-include="components/header.html"]', 'header');
  loadComponent('[data-include="components/footer.html"]', 'footer');
});
