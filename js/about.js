document.addEventListener('DOMContentLoaded', function() {
    // Get all FAQ question elements
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    // Add click event listener to each question
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            // Toggle active class on parent faq-item
            const faqItem = this.parentNode;
            const answer = faqItem.querySelector('.faq-answer');
            const isActive = faqItem.classList.contains('active');
            
            // Close all other open FAQ items
            document.querySelectorAll('.faq-item.active').forEach(item => {
                // Skip the current item
                if (item !== faqItem) {
                    item.classList.remove('active');
                    item.querySelector('.faq-toggle').textContent = '+';
                    item.querySelector('.faq-answer').style.maxHeight = '0px';
                }
            });
            
            // Toggle the clicked item with calculated height
            if (isActive) {
                // Close this item
                faqItem.classList.remove('active');
                this.querySelector('.faq-toggle').textContent = '+';
                answer.style.maxHeight = '0px';
            } else {
                // Open this item
                faqItem.classList.add('active');
                this.querySelector('.faq-toggle').textContent = '−';
                answer.style.maxHeight = answer.scrollHeight + 40 + 'px'; // Add padding
            }
        });
    });
    
    // Auto-open the first FAQ item with animation
    if (faqQuestions.length > 0) {
        const firstFaqItem = faqQuestions[0].parentNode;
        const firstAnswer = firstFaqItem.querySelector('.faq-answer');
        
        firstFaqItem.classList.add('active');
        faqQuestions[0].querySelector('.faq-toggle').textContent = '−';
        
        // Set the height after a small delay to ensure DOM is ready
        setTimeout(() => {
            firstAnswer.style.maxHeight = firstAnswer.scrollHeight + 40 + 'px';
        }, 10);
    }
});