/**
 * Custom Notification System
 * Professional, user-friendly alerts/modals
 */

class NotificationSystem {
  /**
   * Show info notification
   */
  static info(title, message) {
    this.showModal(title, message, 'info', 'ℹ️');
  }

  /**
   * Show success notification
   */
  static success(title, message) {
    this.showModal(title, message, 'success', '✅');
  }

  /**
   * Show warning notification
   */
  static warning(title, message) {
    this.showModal(title, message, 'warning', '⚠️');
  }

  /**
   * Show error notification
   */
  static error(title, message) {
    this.showModal(title, message, 'error', '❌');
  }

  /**
   * Show processing/loading notification with timeout
   */
  static processing(title, message, timeoutSeconds = 30) {
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        padding: 40px;
        max-width: 600px;
        width: 90%;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      ">
        <style>
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          @keyframes checkmark {
            0% { stroke-dashoffset: 51; }
            100% { stroke-dashoffset: 0; }
          }
          .timeline-step {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
            animation: slideIn 0.5s ease-out forwards;
            opacity: 0;
          }
          .timeline-step:nth-child(1) { animation-delay: 0.1s; }
          .timeline-step:nth-child(2) { animation-delay: 0.3s; }
          .timeline-step:nth-child(3) { animation-delay: 0.5s; }
          .timeline-step:nth-child(4) { animation-delay: 0.7s; }
          .timeline-step:nth-child(5) { animation-delay: 0.9s; }
          .timeline-indicator {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            font-size: 20px;
            font-weight: 700;
            color: white;
          }
          .timeline-step.active .timeline-indicator {
            background: #2e5b8a;
            animation: spin 1s linear infinite;
          }
          .timeline-step.completed .timeline-indicator {
            background: #4caf50;
          }
          .timeline-step.pending .timeline-indicator {
            background: #ccc;
          }
          .timeline-content {
            flex: 1;
            text-align: left;
          }
          .timeline-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 2px;
          }
          .timeline-desc {
            font-size: 12px;
            color: #999;
          }
        </style>

        <div style="display: flex; gap: 16px; align-items: flex-start; margin-bottom: 28px;">
          <div style="font-size: 40px; line-height: 1;">🤖</div>
          <div>
            <h2 style="margin: 0 0 4px 0; font-size: 18px; color: #333;">${title}</h2>
            <p style="margin: 0; font-size: 13px; color: #666;">${message}</p>
          </div>
        </div>

        <div id="processingTimeline" style="margin-top: 24px; margin-bottom: 24px;">
          <div class="timeline-step active">
            <div class="timeline-indicator">⊙</div>
            <div class="timeline-content">
              <div class="timeline-title">Reading Files</div>
              <div class="timeline-desc">Loading and parsing uploaded documents</div>
            </div>
          </div>
          <div class="timeline-step pending">
            <div class="timeline-indicator">2</div>
            <div class="timeline-content">
              <div class="timeline-title">Extracting Data</div>
              <div class="timeline-desc">Pulling expense information from documents</div>
            </div>
          </div>
          <div class="timeline-step pending">
            <div class="timeline-indicator">3</div>
            <div class="timeline-content">
              <div class="timeline-title">AI Analysis</div>
              <div class="timeline-desc">Categorizing expenses with confidence scoring</div>
            </div>
          </div>
          <div class="timeline-step pending">
            <div class="timeline-indicator">4</div>
            <div class="timeline-content">
              <div class="timeline-title">Mapping Expenses</div>
              <div class="timeline-desc">Assigning to AFI categories and Document Hub</div>
            </div>
          </div>
          <div class="timeline-step pending">
            <div class="timeline-indicator">5</div>
            <div class="timeline-content">
              <div class="timeline-title">Storing Results</div>
              <div class="timeline-desc">Saving to database and syncing</div>
            </div>
          </div>
        </div>

        <div style="
          background: #f0f4f8;
          border-radius: 6px;
          padding: 12px 16px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div style="font-size: 12px; font-weight: 600; color: #2e5b8a;">Time:</div>
            <div style="
              width: 200px;
              height: 4px;
              background: #ddd;
              border-radius: 2px;
              overflow: hidden;
            ">
              <div id="progressBar" style="
                width: 5%;
                height: 100%;
                background: #2e5b8a;
                transition: width 0.3s ease;
              "></div>
            </div>
          </div>
          <div style="
            font-size: 12px;
            color: #666;
            font-weight: 600;
            min-width: 45px;
            text-align: right;
          "><span id="elapsedTime">0</span>s</div>
        </div>

        <div style="
          display: flex;
          gap: 12px;
        ">
          <button onclick="document.getElementById('notificationModal').remove()" style="
            flex: 1;
            padding: 10px 16px;
            background: white;
            color: #2e5b8a;
            border: 1px solid #2e5b8a;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#f0f4f8'" onmouseout="this.style.background='white'">
            Cancel Processing
          </button>
          <div style="
            flex: 1;
            padding: 10px 16px;
            background: #f5f5f5;
            border-radius: 4px;
            text-align: center;
            font-size: 12px;
            color: #666;
          ">
            Expected time: ${timeoutSeconds}s
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let elapsedSeconds = 0;
    let timeoutReached = false;

    // Start timer
    const timerInterval = setInterval(() => {
      elapsedSeconds++;
      const timeDisplay = document.getElementById('elapsedTime');
      const progressBar = document.getElementById('progressBar');

      if (timeDisplay) {
        timeDisplay.textContent = elapsedSeconds;
        const progress = Math.min((elapsedSeconds / timeoutSeconds) * 100, 100);
        progressBar.style.width = progress + '%';

        // Change color to warning after 20 seconds
        if (elapsedSeconds > timeoutSeconds * 0.66) {
          progressBar.style.background = '#fbc02d';
        }

        // Timeout reached
        if (elapsedSeconds >= timeoutSeconds && !timeoutReached) {
          timeoutReached = true;
          progressBar.style.background = '#f44336';

          // Show timeout warning
          NotificationSystem.error(
            'Processing Timeout',
            'The processing is taking longer than expected (${timeoutSeconds}+ seconds).\n\nThis might be due to:\n• Large file size\n• Network delay\n• Server issue\n\nTry uploading smaller files or refresh the page.'
          );
          clearInterval(timerInterval);
          modal.remove();
        }
      }
    }, 1000);

    // Expose method to update timeline progress
    modal.updateProgress = function(stepNumber) {
      const steps = document.querySelectorAll('.timeline-step');
      steps.forEach((step, index) => {
        step.classList.remove('active', 'completed', 'pending');
        if (index < stepNumber - 1) {
          step.classList.add('completed');
        } else if (index === stepNumber - 1) {
          step.classList.add('active');
        } else {
          step.classList.add('pending');
        }
      });
    };

    // Cleanup on close
    modal.cleanup = function() {
      clearInterval(timerInterval);
    };

    return modal;
  }

  /**
   * Core modal implementation
   */
  static showModal(title, message, type = 'info', icon = 'ℹ️') {
    // Close existing modal if any
    const existing = document.getElementById('notificationModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    // Color scheme by type
    const colors = {
      info: { bg: '#e8f3ff', border: '#2e5b8a', text: '#1f5f9d' },
      success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
      warning: { bg: '#fff3cd', border: '#fbc02d', text: '#856404' },
      error: { bg: '#ffebee', border: '#f44336', text: '#c62828' }
    };

    const color = colors[type] || colors.info;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 90%;
        overflow: hidden;
      ">
        <div style="
          background: ${color.bg};
          border-left: 4px solid ${color.border};
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        ">
          <div style="
            font-size: 28px;
            flex-shrink: 0;
            margin-top: -2px;
          ">${icon}</div>
          <div style="flex: 1;">
            <h2 style="
              margin: 0 0 8px 0;
              font-size: 16px;
              font-weight: 700;
              color: #333;
            ">${title}</h2>
            <p style="
              margin: 0;
              font-size: 14px;
              color: #666;
              line-height: 1.6;
              white-space: pre-wrap;
              word-wrap: break-word;
            ">${message}</p>
          </div>
        </div>
        <div style="
          padding: 16px 24px;
          text-align: right;
          border-top: 1px solid #eee;
        ">
          <button onclick="document.getElementById('notificationModal').remove()" style="
            padding: 10px 24px;
            background: ${color.border};
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
            OK
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * Show confirmation dialog
   */
  static confirm(title, message, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        max-width: 500px;
        width: 90%;
      ">
        <div style="
          padding: 24px;
          border-left: 4px solid #2e5b8a;
        ">
          <h2 style="
            margin: 0 0 12px 0;
            font-size: 16px;
            font-weight: 700;
            color: #333;
          ">${title}</h2>
          <p style="
            margin: 0;
            font-size: 14px;
            color: #666;
            line-height: 1.6;
            white-space: pre-wrap;
            word-wrap: break-word;
          ">${message}</p>
        </div>
        <div style="
          padding: 16px 24px;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          border-top: 1px solid #eee;
        ">
          <button onclick="document.getElementById('notificationModal').remove(); window.notificationCancel && window.notificationCancel();" style="
            padding: 10px 24px;
            background: white;
            color: #2e5b8a;
            border: 1px solid #2e5b8a;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#f0f4f8'" onmouseout="this.style.background='white'">
            Cancel
          </button>
          <button onclick="document.getElementById('notificationModal').remove(); window.notificationConfirm && window.notificationConfirm();" style="
            padding: 10px 24px;
            background: #2e5b8a;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
            Confirm
          </button>
        </div>
      </div>
    `;

    window.notificationConfirm = onConfirm;
    window.notificationCancel = onCancel;

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * Close active notification
   */
  static close() {
    const modal = document.getElementById('notificationModal');
    if (modal) modal.remove();
  }
}
