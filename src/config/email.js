const RESEND_API_KEY = 're_bQECaWJi_GQCuxSD63dPLjzAn9hMF5Biw';

export const sendVerificationEmail = async (emailId, otp) => {
    try {
        if (!emailId || !otp) return null;
        
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev',
                to: [emailId],
                subject: 'Verification Email from RakshaAi',
                html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body {
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                      background-color: #f4f7f6;
                      margin: 0;
                      padding: 0;
                    }
                    .container {
                      max-width: 600px;
                      margin: 40px auto;
                      background-color: #ffffff;
                      border-radius: 12px;
                      overflow: hidden;
                      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                    }
                    .header {
                      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                      padding: 30px 20px;
                      text-align: center;
                      color: white;
                    }
                    .header h1 {
                      margin: 0;
                      font-size: 28px;
                      letter-spacing: 1px;
                    }
                    .content {
                      padding: 40px 30px;
                      text-align: center;
                      color: #333333;
                    }
                    .content h2 {
                      color: #1e3c72;
                    }
                    .content p {
                      font-size: 16px;
                      line-height: 1.6;
                      margin-bottom: 25px;
                    }
                    .code-container {
                      background-color: #f8f9fa;
                      border: 2px dashed #2a5298;
                      border-radius: 8px;
                      padding: 20px;
                      margin: 20px 0;
                      display: inline-block;
                    }
                    .code {
                      font-size: 36px;
                      font-weight: bold;
                      color: #1e3c72;
                      letter-spacing: 5px;
                      margin: 0;
                    }
                    .footer {
                      background-color: #f8f9fa;
                      padding: 20px;
                      text-align: center;
                      font-size: 13px;
                      color: #888888;
                      border-top: 1px solid #eeeeee;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>RakshaAi</h1>
                    </div>
                    <div class="content">
                      <h2>Verify Your Email Address</h2>
                      <p>Thank you for choosing RakshaAi. To ensure your security and complete your registration, please use the verification code below.</p>
                      
                      <div class="code-container">
                        <p class="code">${otp}</p>
                      </div>
                      
                      <p>If you didn't request this code, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                      <p>&copy; ${new Date().getFullYear()} RakshaAi. All rights reserved.</p>
                      <p>Your ultimate security and emergency response system.</p>
                    </div>
                  </div>
                </body>
                </html>
                `
            })
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.log("Error sending email:", error);
        return null;
    }
}