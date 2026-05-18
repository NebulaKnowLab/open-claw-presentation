// Task System for Step-by-Step Learning
class TaskSystem {
    constructor() {
        this.completedSteps = new Set();
        this.revealedHints = [];
        this.hintsStartTime = null;
    }

    initialize() {
        // Initialize task progress tracking
        this.updateTaskProgress();
        
        // Initialize step-based hint tracking
        this.revealedHints = [];
        window.revealedHints = this.revealedHints;
        
        console.log('Step-based task system initialized');
        console.log('Task steps available:', window.templateData?.content?.task_steps?.length || 0);
    }

    revealStepHint(stepIndex) {
        const hintContent = document.getElementById(`step-hint-${stepIndex}`);
        const hintBtn = document.querySelector(`.step-hint-btn[data-step-index="${stepIndex}"]`);
        const completeBtn = document.getElementById(`complete-btn-${stepIndex}`);
        
        if (hintContent && hintBtn && !hintBtn.disabled) {
            // Check if already revealed or step is completed
            if (this.completedSteps.has(parseInt(stepIndex)) || this.revealedHints.some(h => h.step === parseInt(stepIndex))) {
                return; // Don't reveal if completed or already shown
            }
            
            // Disable and hide the hint button
            hintBtn.disabled = true;
            hintBtn.style.display = 'none';
            
            // Show hint content
            hintContent.classList.remove('hidden');
            
            // Track hint usage
            this.revealedHints.push({ step: parseInt(stepIndex), timestamp: new Date().toISOString() });
            window.revealedHints = this.revealedHints;
            
            // Ensure Mark Completed button remains visible
            if (completeBtn) {
                completeBtn.style.display = 'block';
            }
            
            // Update progress and animate reveal
            this.updateTaskProgress();
            hintContent.style.opacity = '0';
            hintContent.style.transform = 'translateY(20px)';
            hintContent.style.transition = 'all 0.5s ease-out';
            setTimeout(() => {
                hintContent.style.opacity = '1';
                hintContent.style.transform = 'translateY(0)';
            }, 50);
            
            this.checkAllHintsUsed();
        }
    }

    markStepCompleted(stepIndex) {
        const idx = parseInt(stepIndex);
        if (Number.isNaN(idx)) return;
        if (this.completedSteps.has(idx)) return; // Already completed
        
        this.completedSteps.add(idx);
        
        // Update complete button
        const btn = document.getElementById(`complete-btn-${idx}`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-check-circle mr-1"></i><span class="align-middle">Completed</span>';
            btn.classList.remove('border-green-500', 'text-green-600');
            btn.classList.add('bg-green-500', 'text-white', 'border-green-600');
        }
        
        // Hide Reveal Hint button
        const hintBtn = document.querySelector(`.step-hint-btn[data-step-index="${idx}"]`);
        if (hintBtn) {
            hintBtn.style.display = 'none';
        }
        
        this.updateTaskProgress();
    }

    updateTaskProgress() {
        const progressBar = document.getElementById('taskProgressBar');
        const progressText = document.getElementById('taskProgressText');
        const hintsUsedDisplay = document.getElementById('hintsUsedDisplay');
        
        // Get task steps from template data
        const totalSteps = window.templateData?.taskSteps?.length || 0;
        const hintsUsed = this.revealedHints.length;
        const totalAvailableHints = window.templateData?.taskSteps?.filter(step => step.hint).length || 0;
        const completed = this.completedSteps.size;
        
        // Update hints used display
        if (hintsUsedDisplay) {
            hintsUsedDisplay.textContent = `${hintsUsed}/${totalAvailableHints}`;
        }
        
        // Update progress text
        if (progressText) {
            progressText.textContent = `${completed} of ${totalSteps} steps completed`;
        }
        
        // Update progress bar (based on completed steps)
        if (progressBar && totalSteps > 0) {
            const progressPercentage = (completed / totalSteps) * 100;
            progressBar.style.width = `${Math.min(progressPercentage, 100)}%`;
        }
    }

    checkAllHintsUsed() {
        const totalAvailableHints = window.templateData?.content?.task_steps?.filter(step => step.hint).length || 0;
        const hintsUsed = this.revealedHints.length;
        
        if (hintsUsed >= totalAvailableHints && totalAvailableHints > 0) {
            const allHintsBtn = document.getElementById('allHintsUsedBtn');
            if (allHintsBtn) {
                allHintsBtn.classList.remove('hidden');
                allHintsBtn.style.animation = 'slideInUp 0.5s ease-out';
            }
        }
    }

    copyCode(stepIndex) {
        const codeElement = document.getElementById(`code-${stepIndex}`);
        if (codeElement) {
            const code = codeElement.textContent;
            navigator.clipboard.writeText(code).then(() => {
                // Show success feedback
                const btn = document.querySelector(`[data-step-index="${stepIndex}"]`);
                if (btn) {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                    btn.classList.add('bg-green-100', 'text-green-800');
                    
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('bg-green-100', 'text-green-800');
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy code:', err);
            });
        }
    }

    copyHintCode(stepIndex) {
        const codeElement = document.getElementById(`hint-code-${stepIndex}`);
        if (codeElement) {
            const code = codeElement.textContent;
            navigator.clipboard.writeText(code).then(() => {
                // Show success feedback
                const btn = document.querySelector(`[onclick="copyHintCode(this.dataset.stepIndex)"][data-step-index="${stepIndex}"]`);
                if (btn) {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
                    btn.classList.add('bg-green-100', 'text-green-800');
                    
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('bg-green-100', 'text-green-800');
                    }, 2000);
                }
            }).catch(err => {
                console.error('Failed to copy hint code:', err);
            });
        }
    }
}

// Carousel system for step and hint images
class CarouselSystem {
    constructor() {
        this.stepCarouselIndex = {};
        this.hintCarouselIndex = {};
    }

    updateCarousel(trackId, indicatorId, index) {
        const track = document.getElementById(trackId);
        const indicator = document.getElementById(indicatorId);
        if (!track) return;
        
        const total = track.children ? track.children.length : 0;
        if (total === 0) return 0;
        
        const clamped = Math.max(0, Math.min(index, total - 1));
        
        // Ensure each child takes full width of track's viewport
        Array.from(track.children).forEach(child => {
            child.style.minWidth = '100%';
        });
        
        track.style.transform = `translateX(-${clamped * 100}%)`;
        if (indicator) indicator.textContent = String(clamped + 1);
        return clamped;
    }

    nextStepImage(stepIdx) {
        const key = String(stepIdx);
        const trackId = `step-carousel-track-${stepIdx}`;
        const indicatorId = `step-carousel-indicator-${stepIdx}`;
        const track = document.getElementById(trackId);
        if (!track) return;
        
        const total = track.children ? track.children.length : 0;
        const current = (this.stepCarouselIndex[key] || 0) + 1;
        this.stepCarouselIndex[key] = this.updateCarousel(trackId, indicatorId, current % total);
    }

    prevStepImage(stepIdx) {
        const key = String(stepIdx);
        const trackId = `step-carousel-track-${stepIdx}`;
        const indicatorId = `step-carousel-indicator-${stepIdx}`;
        const track = document.getElementById(trackId);
        if (!track) return;
        
        const total = track.children ? track.children.length : 0;
        const current = (this.stepCarouselIndex[key] || 0) - 1;
        const next = (current + total) % total;
        this.stepCarouselIndex[key] = this.updateCarousel(trackId, indicatorId, next);
    }

    nextHintImage(stepIdx) {
        const key = String(stepIdx);
        const trackId = `hint-carousel-track-${stepIdx}`;
        const indicatorId = `hint-carousel-indicator-${stepIdx}`;
        const track = document.getElementById(trackId);
        if (!track) return;
        
        const total = track.children ? track.children.length : 0;
        const current = (this.hintCarouselIndex[key] || 0) + 1;
        this.hintCarouselIndex[key] = this.updateCarousel(trackId, indicatorId, current % total);
    }

    prevHintImage(stepIdx) {
        const key = String(stepIdx);
        const trackId = `hint-carousel-track-${stepIdx}`;
        const indicatorId = `hint-carousel-indicator-${stepIdx}`;
        const track = document.getElementById(trackId);
        if (!track) return;
        
        const total = track.children ? track.children.length : 0;
        const current = (this.hintCarouselIndex[key] || 0) - 1;
        const next = (current + total) % total;
        this.hintCarouselIndex[key] = this.updateCarousel(trackId, indicatorId, next);
    }

    initializeCarousels() {
        // Initialize first slide for all carousels after load
        const stepTracks = document.querySelectorAll('[id^="step-carousel-track-"]');
        stepTracks.forEach(el => {
            const id = el.id.replace('step-carousel-track-','');
            this.updateCarousel(`step-carousel-track-${id}`, `step-carousel-indicator-${id}`, 0);
        });
        
        const hintTracks = document.querySelectorAll('[id^="hint-carousel-track-"]');
        hintTracks.forEach(el => {
            const id = el.id.replace('hint-carousel-track-','');
            this.updateCarousel(`hint-carousel-track-${id}`, `hint-carousel-indicator-${id}`, 0);
        });
    }
}

// Global instances
window.taskSystem = new TaskSystem();
window.carouselSystem = new CarouselSystem();

// Global functions for backward compatibility
function initializeTaskSystem() {
    window.taskSystem.initialize();
}

function revealStepHint(stepIndex) {
    window.taskSystem.revealStepHint(stepIndex);
}

function markStepCompleted(stepIndex) {
    window.taskSystem.markStepCompleted(stepIndex);
}

function copyCode(stepIndex) {
    window.taskSystem.copyCode(stepIndex);
}

function copyHintCode(stepIndex) {
    window.taskSystem.copyHintCode(stepIndex);
}

function nextStepImage(stepIdx) {
    window.carouselSystem.nextStepImage(stepIdx);
}

function prevStepImage(stepIdx) {
    window.carouselSystem.prevStepImage(stepIdx);
}

function nextHintImage(stepIdx) {
    window.carouselSystem.nextHintImage(stepIdx);
}

function prevHintImage(stepIdx) {
    window.carouselSystem.prevHintImage(stepIdx);
}

// Export for global access
window.initializeTaskSystem = initializeTaskSystem;
window.revealStepHint = revealStepHint;
window.markStepCompleted = markStepCompleted;
window.copyCode = copyCode;
window.copyHintCode = copyHintCode;
window.nextStepImage = nextStepImage;
window.prevStepImage = prevStepImage;
window.nextHintImage = nextHintImage;
window.prevHintImage = prevHintImage;
