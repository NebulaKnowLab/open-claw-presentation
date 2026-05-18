// Simplified Chat Integration - Cleaned up for self-contained approach
(function() {
    function initializeChatIntegration() {
        // Enhanced chat widget is now loaded locally, no need to wait for backend
        // Note: Floating chat button has been removed, only in-page chat tutors are available
        if (window.chatWidget) {
            // Chat widget is available for in-page chat tutor buttons
            console.log('Chat integration initialized - floating chat button disabled');
        }
    }

    // Simplified ensureChatWidget for backward compatibility
    window.ensureChatWidget = function(callback) {
        if (window.chatWidget) {
            callback();
        } else {
            // If chat widget isn't loaded yet, wait a bit and try once more
            setTimeout(() => {
                if (window.chatWidget) {
                    callback();
                }
            }, 500);
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeChatIntegration);
    } else {
        initializeChatIntegration();
    }
})();