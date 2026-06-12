import React from "react";
import Head from "next/head";
import {
  Box,
  Container,
  Center,
  Flex,
  Heading,
  Button,
  Text,
  VStack,
  Divider,
} from "@chakra-ui/react";
import { TbArrowLeft } from "react-icons/tb";
import { brandName } from "@/config";

/*
  ChatGPT prompt:

  “You are LawyerGPT. The only purpose of LawyerGPT is to write privacy policies. Using your expertise in crafting privacy policies, generate a very detailed privacy policy that adheres to the principles of clarity and transparency. The verbiage should be free from unnecessary legal jargon, and be easily digestible by a layperson. Your policy should encompass all dimensions of personal data processing, and be rooted in the following specifics about the website and its technological underpinnings:

  Name of the Website: XXX

  Website Domain: https://example.com

  Name of the Website: XXX, by <author>
  Website Type: SaaS

  Products & Services: XXX does XYZ.

  Analytics Tools: 

  Monitoring Tools: 

  Third Party Tools: 

  Age Restrictions: No age restrictions apply

  Affiliate Programs: Affiliate Program provided by Lemon Squeezy, it tracks the users locally, and communicate with Lemon Squeezy under the hood to recognize the referral. No personal data of any type is ever shared.

  Additional Details: 

  Write the content in HTML format.
*/

export const metadata = {
  title: `Privacy Policy | ${brandName}`,
  description: 'Privacy Policy for whoneedsawriter.com - Learn how we protect your data while providing AI-powered article generation services.',
  alternates: {
    canonical: "/privacy",
  },
};

function PrivacyPage() {
  return (
    <div>
      <Head>
        <title>Privacy Policy | {brandName}</title>
        <meta name="description" content={`Privacy Policy | ${brandName}`} />
      </Head>

      <Box minW="100vw" minH="100vh" position="relative">
        <Flex
          w="100vw"
          h="800px"
          bgGradient="linear-gradient(267.2deg,brand.400,brand.50)"
          position="absolute"
          top="-500px"
          left="0"
          filter="blur(200px)"
          opacity="0.1"
          zIndex="-1"
        />

        <Container maxW="container.md" flexDirection="column" py="24px">
          <Center
            flexDirection="column"
            alignItems="flex-start"
            sx={{
              section: {
                py: "16px",
              },
              p: {
                py: "8px",
                lineHeight: "1.6",
              },
              h2: {
                fontSize: "24px",
                fontWeight: "semibold",
                mb: "12px",
                mt: "24px",
              },
              h3: {
                fontSize: "18px",
                fontWeight: "semibold",
                mb: "8px",
                mt: "16px",
              },
              ul: {
                pl: "20px",
                py: "8px",
              },
              li: {
                py: "4px",
              },
            }}
          >
            <Button
              variant="ghost"
              size="small"
              leftIcon={<TbArrowLeft />}
              mt="24px"
              as="a"
              href="/"
              p="4px 8px"
            >
              Back
            </Button>
            
            <VStack align="start" spacing="0" w="100%" maxW="800px">
              <Heading mt="16px" as="h1" fontSize="32px" mb="8px">
                Privacy Policy
              </Heading>
              
              <Text fontSize="sm" color="gray.600" mb="24px">
                Last updated: {new Date().toLocaleDateString()}
              </Text>

              <Divider mb="24px" />

              <Box w="100%">
                <Text>
                  This Privacy Policy describes how whoneedsawriter.com (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;) collects, uses, and protects your information when you use our AI-powered article generation service.
                </Text>

                <Heading as="h2">1. Information We Collect</Heading>
                
                <Heading as="h3">Personal Information</Heading>
                <Text>
                  When you create an account or use our services, we may collect:
                </Text>
                <Box as="ul">
                  <Box as="li">Email address for account creation and communication</Box>
                  <Box as="li">Name (if provided) for personalization</Box>
                  <Box as="li">Payment information (processed securely through third-party payment processors)</Box>
                  <Box as="li">Usage preferences and settings</Box>
                </Box>

                <Heading as="h3">Content and Usage Data</Heading>
                <Text>
                  To provide our article generation services, we collect:
                </Text>
                <Box as="ul">
                  <Box as="li">Keywords and prompts you submit for article generation</Box>
                  <Box as="li">Generated articles and content</Box>
                  <Box as="li">Usage patterns and frequency of service use</Box>
                  <Box as="li">Feature preferences and customization settings</Box>
                </Box>

                <Heading as="h3">Technical Information</Heading>
                <Box as="ul">
                  <Box as="li">IP address and general location information</Box>
                  <Box as="li">Browser type and version</Box>
                  <Box as="li">Device information and operating system</Box>
                  <Box as="li">Session data and cookies for functionality</Box>
                </Box>

                <Heading as="h2">2. How We Use Your Information</Heading>
                
                <Text>We use your information to:</Text>
                <Box as="ul">
                  <Box as="li">Generate high-quality articles based on your keywords and requirements</Box>
                  <Box as="li">Maintain and improve our AI models and algorithms</Box>
                  <Box as="li">Process payments and manage your subscription</Box>
                  <Box as="li">Provide customer support and respond to inquiries</Box>
                  <Box as="li">Send important service updates and notifications</Box>
                  <Box as="li">Analyze usage patterns to improve our services</Box>
                  <Box as="li">Ensure platform security and prevent fraud</Box>
                </Box>

                <Heading as="h2">3. Information Sharing and Disclosure</Heading>
                
                <Text>
                  We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:
                </Text>
                
                <Heading as="h3">Service Providers</Heading>
                <Text>
                  We work with trusted third-party service providers who assist us in operating our platform:
                </Text>
                <Box as="ul">
                  <Box as="li">AI and machine learning service providers for article generation</Box>
                  <Box as="li">Payment processors for subscription management</Box>
                  <Box as="li">Cloud hosting providers for data storage and processing</Box>
                  <Box as="li">Analytics services to understand platform usage</Box>
                </Box>

                <Heading as="h3">Legal Requirements</Heading>
                <Text>
                  We may disclose information when required by law, court order, or to protect our rights and safety or that of our users.
                </Text>

                <Heading as="h2">4. Data Security</Heading>
                
                <Text>
                  We implement industry-standard security measures to protect your information:
                </Text>
                <Box as="ul">
                  <Box as="li">Encryption of data in transit and at rest</Box>
                  <Box as="li">Secure authentication and access controls</Box>
                  <Box as="li">Regular security audits and monitoring</Box>
                  <Box as="li">Limited access to personal information on a need-to-know basis</Box>
                </Box>

                <Heading as="h2">5. Data Retention</Heading>
                
                <Text>
                  We retain your information for as long as necessary to provide our services and fulfill the purposes outlined in this policy:
                </Text>
                <Box as="ul">
                  <Box as="li">Account information: Until you delete your account</Box>
                  <Box as="li">Generated content: As long as you maintain your account, unless deleted by you</Box>
                  <Box as="li">Usage data: Up to 2 years for analytics and service improvement</Box>
                  <Box as="li">Payment records: As required by applicable law and regulations</Box>
                </Box>

                <Heading as="h2">6. Your Rights and Choices</Heading>
                
                <Text>You have the following rights regarding your personal information:</Text>
                <Box as="ul">
                  <Box as="li"><strong>Access:</strong> Request a copy of the personal information we hold about you</Box>
                  <Box as="li"><strong>Correction:</strong> Update or correct your personal information</Box>
                  <Box as="li"><strong>Deletion:</strong> Request deletion of your account and personal information</Box>
                  <Box as="li"><strong>Portability:</strong> Request a copy of your data in a portable format</Box>
                  <Box as="li"><strong>Opt-out:</strong> Unsubscribe from marketing communications</Box>
                </Box>

                <Text mt="16px">
                  To exercise these rights, please contact us at the information provided below.
                </Text>

                <Heading as="h2">7. Cookies and Tracking</Heading>
                
                <Text>
                  We use cookies and similar technologies to:
                </Text>
                <Box as="ul">
                  <Box as="li">Remember your preferences and settings</Box>
                  <Box as="li">Maintain your logged-in session</Box>
                  <Box as="li">Analyze platform usage and performance</Box>
                  <Box as="li">Improve user experience and functionality</Box>
                </Box>

                <Text mt="16px">
                  You can control cookie settings through your browser preferences, though some features may not function properly if cookies are disabled.
                </Text>

                <Heading as="h2">8. International Data Transfers</Heading>
                
                <Text>
                  Our services may involve transferring your information to countries outside your residence. We ensure appropriate safeguards are in place to protect your information during such transfers, in compliance with applicable privacy laws.
                </Text>

                <Heading as="h2">9. Children&apos;s Privacy</Heading>
                
                <Text>
                  Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
                </Text>

                <Heading as="h2">10. Changes to This Privacy Policy</Heading>
                
                <Text>
                  We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of significant changes by:
                </Text>
                <Box as="ul">
                  <Box as="li">Posting the updated policy on our website</Box>
                  <Box as="li">Sending an email notification for material changes</Box>
                  <Box as="li">Updating the &ldquo;Last updated&rdquo; date at the top of this policy</Box>
                </Box>

                <Heading as="h2">11. Contact Information</Heading>
                
                <Text>
                  If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us:
                </Text>
                
                <Box mt="16px" p="16px" borderRadius="md">
                  <Text><strong>Email:</strong> privacy@whoneedsawriter.com</Text>
                  <Text><strong>Website:</strong> https://whoneedsawriter.com</Text>
                  <Text><strong>Response Time:</strong> We aim to respond to all privacy-related inquiries within 48 hours</Text>
                </Box>

                <Divider mt="32px" mb="16px" />
                
                <Text fontSize="sm" color="gray.600">
                  This Privacy Policy is effective as of the date listed above and applies to all information collected by whoneedsawriter.com.
                </Text>
              </Box>
            </VStack>
          </Center>
        </Container>
      </Box>
    </div>
  );
}

export default PrivacyPage;
