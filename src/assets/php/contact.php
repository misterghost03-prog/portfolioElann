<?php
// Load Composer's autoloader
require 'vendor/autoload.php';

// Load SMTP config from separate file (e.g., mail-config.php)
$config = require 'config.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);

try {
    // Enable verbose debug output
    $mail->SMTPDebug = 2;  // 0 = off, 1 = client messages, 2 = client and server messages
    $mail->Debugoutput = 'html';

    // Server settings
    $mail->isSMTP();
    $mail->Host       = $config['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $config['username'];
    $mail->Password   = $config['password'];
    $mail->SMTPSecure = $config['secure'];  // tls or ssl
    $mail->Port       = $config['port'];

    // Recipients
    $mail->setFrom($config['from_email'], $config['from_name']);

    // Assume user input from POST form
    $userEmail = filter_var($_POST['email'], FILTER_VALIDATE_EMAIL);
    if (!$userEmail) {
        throw new Exception('Invalid email address');
    }

    $mail->addAddress($config['to_email']); // your email where you want to receive messages
    $mail->addReplyTo($userEmail);

    // Content
    $mail->isHTML(true);
    $mail->Subject = 'New Contact Form Message';
    
    $messageBody = "
        <strong>From:</strong> " . htmlspecialchars($_POST['firstname']) . " " . htmlspecialchars($_POST['lastname']) . "<br>
        <strong>Email:</strong> " . htmlspecialchars($userEmail) . "<br>
        <strong>Message:</strong><br>" . nl2br(htmlspecialchars($_POST['message']));
    
    $mail->Body = $messageBody;

    $mail->send();
    echo 'Message has been sent';

} catch (Exception $e) {
    echo "Message could not be sent. Mailer Error: {$mail->ErrorInfo}";
}