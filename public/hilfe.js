document.addEventListener("DOMContentLoaded", () => {
    const questions = document.querySelectorAll(".faq-question");
    
    questions.forEach(q => {
      q.addEventListener("click", () => {
        const expanded = q.getAttribute("aria-expanded") === "true";
        q.setAttribute("aria-expanded", !expanded);
        
        const answer = q.nextElementSibling;
        if (!expanded) {
          answer.style.maxHeight = answer.scrollHeight + "px";
          answer.style.paddingBottom = "14px";
        } else {
          answer.style.maxHeight = 0;
          answer.style.paddingBottom = 0;
        }
      });
    });
  });