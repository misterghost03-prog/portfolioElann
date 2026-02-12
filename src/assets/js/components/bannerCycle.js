document.addEventListener('DOMContentLoaded', function() {
  const slides = document.querySelectorAll('.banner__slide');
  const indicators = document.querySelectorAll('.banner__indicator');
  let current = 0;

  function showSlide(index) {
    slides.forEach((slide, i) => {
      slide.classList.toggle('banner__slide--active', i === index);
      if (indicators[i]) {
        indicators[i].classList.toggle('banner__indicator--active', i === index);
      }
    });
  }

  setInterval(() => {
    current = (current + 1) % slides.length;
    showSlide(current);
  }, 5000);
});