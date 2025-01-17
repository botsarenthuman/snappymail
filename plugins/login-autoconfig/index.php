<?php
/**
 * https://datatracker.ietf.org/doc/draft-bucksch-autoconfig/
 */

use MailSo\Net\Enumerations\ConnectionSecurityType;

class LoginAutoconfigPlugin extends \RainLoop\Plugins\AbstractPlugin
{
	const
		NAME     = 'Login Autoconfig',
		AUTHOR   = 'SnappyMail',
		URL      = 'https://snappymail.eu/',
		VERSION  = '1.0',
		RELEASE  = '2024-02-05',
		REQUIRED = '2.34.0',
		CATEGORY = 'Login',
		LICENSE  = 'MIT',
		DESCRIPTION = 'Tries to login using the domain autoconfig';

	public function Init() : void
	{
		$this->addHook('login.credentials.step-1', 'detect');
	}

	public function detect(string $sEmail) : void
	{
		if (\str_contains($sEmail, '@')) {
			$oProvider = $this->Manager()->Actions()->DomainProvider();
			$sDomain = \MailSo\Base\Utils::GetDomainFromEmail($sEmail);
			$oDomain = $oProvider->Load($sDomain, false);
			if (!$oDomain) {
				$result = \RainLoop\Providers\Domain\Autoconfig::discover($sEmail);
				if ($result) {
					$typeIMAP = ConnectionSecurityType::AUTO_DETECT;
					if ('STARTTLS' === $result['incomingServer'][0]['socketType']) {
						$typeIMAP = ConnectionSecurityType::STARTTLS;
					} else if ('SSL' === $result['incomingServer'][0]['socketType']) {
						$typeIMAP = ConnectionSecurityType::SSL;
					}
					$typeSMTP = ConnectionSecurityType::AUTO_DETECT;
					if ('STARTTLS' === $result['outgoingServer'][0]['socketType']) {
						$typeSMTP = ConnectionSecurityType::STARTTLS;
					} else if ('SSL' === $result['outgoingServer'][0]['socketType']) {
						$typeSMTP = ConnectionSecurityType::SSL;
					}
					$oDomain = \RainLoop\Model\Domain::fromArray($sDomain, [
						'IMAP' => [
							'host' => $result['incomingServer'][0]['hostname'],
							'port' => $result['incomingServer'][0]['port'],
							'type' => $typeIMAP,
							'shortLogin' => '%EMAILADDRESS%' !== $result['incomingServer'][0]['username'],
//							'ssl' => []
						],
						'SMTP' => [
							'host' => $result['outgoingServer'][0]['hostname'],
							'port' => $result['outgoingServer'][0]['port'],
							'type' => $typeSMTP,
							'shortLogin' => '%EMAILADDRESS%' !== $result['outgoingServer'][0]['username'],
//							'useAuth' => !empty($result['authentication']),
						],
						'Sieve' => [
							'host' => $result['incomingServer'][0]['hostname'],
							'port' => $result['incomingServer'][0]['port'],
							'type' => $typeIMAP,
							'shortLogin' => '%EMAILADDRESS%' !== $result['incomingServer'][0]['username'],
							'enabled' => false
						],
						'whiteList' => ''
					]);
					$oProvider->Save($oDomain);
					\SnappyMail\Log::notice("Domain setup for '{$sDomain}' is created and active");
				}
			}
		}
	}

}
