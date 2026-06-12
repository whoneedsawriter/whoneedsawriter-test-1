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
} from "@chakra-ui/react";
import { TbArrowLeft } from "react-icons/tb";
import { brandName } from "@/config";

/*
  ChatGPT prompt:

  "You are LawyerGPT. The only purpose of LawyerGPT is to write terms and conditions.
  Using your expertise in crafting terms and conditions, generate terms and conditions that adheres
  to the principles of clarity and transparency.
  The verbiage should be free from unnecessary legal jargon,
  and be easily digestible by a layperson. 

  The product is a software product called XXX.
  XXX is a single purchase software/SaaS, which allows the buyer to do XYZ.

  Write the content in HTML format.
*/

export const metadata = {
  title: `Terms and Conditions | Who Needs a Writer`,
  description: '',
  alternates: {
    canonical: "/terms",
  },
};

function PrivacyPage() {
  return (
    <div>
      <Head>
        <title>Terms and Conditions | {brandName}</title>
        <meta
          name="description"
          content={`Terms and Conditions | ${brandName}`}
        />
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

        <Container maxW="container.md" flexDirection="column">
          <Center
            flexDirection="column"
            alignItems="flex-start"
            sx={{
              section: {
                py: "16px",
              },
              p: {
                py: "8px",
              },
              h2: {
                fontSize: "20px",
                fontWeight: "semibold",
                mt: "8px",
              },
              ul: {
                ml: "16px",
                my: "8px",
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
            <Heading my="24px" as="h1">
              Terms and Conditions for &quot;whoneedsawriter.com&quot;
            </Heading>

            <Text fontSize="sm" color="gray.600" mb="6">
              Last updated: {new Date().toLocaleDateString()}
            </Text>

            <Box w="100%" textAlign="left">
              <section>
                <Heading as="h2">1. Acceptance of Terms</Heading>
                <Text>
                  By accessing and using whoneedsawriter.com (the &ldquo;Service&rdquo;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our Service.
                </Text>
              </section>

              <section>
                <Heading as="h2">2. Description of Service</Heading>
                <Text>
                  whoneedsawriter.com is a Software-as-a-Service (SaaS) platform that generates articles based on keywords provided by users. Our AI-powered system creates written content to assist users with their content creation needs.
                </Text>
              </section>

              <section>
                <Heading as="h2">3. User Accounts</Heading>
                <Text>
                  To access certain features of our Service, you may be required to create an account. You are responsible for:
                </Text>
                <ul>
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Providing accurate and complete information</li>
                  <li>Notifying us immediately of any unauthorized use of your account</li>
                </ul>
              </section>

              <section>
                <Heading as="h2">4. Acceptable Use</Heading>
                <Text>
                  You agree to use our Service only for lawful purposes. You may not:
                </Text>
                <ul>
                  <li>Generate content that is illegal, harmful, threatening, abusive, or defamatory</li>
                  <li>Create content that infringes on intellectual property rights</li>
                  <li>Use the Service to spread misinformation or fake news</li>
                  <li>Attempt to reverse engineer, hack, or disrupt our Service</li>
                  <li>Use automated tools to access our Service without permission</li>
                  <li>Generate content for spam or malicious purposes</li>
                </ul>
              </section>

              <section>
                <Heading as="h2">5. Content and Intellectual Property</Heading>
                <Text>
                  You retain ownership of the content generated through our Service. However, you acknowledge that:
                </Text>
                <ul>
                  <li>Generated content may not be entirely original or unique</li>
                  <li>You are responsible for verifying the accuracy and originality of generated content</li>
                  <li>You should review and edit generated content before use</li>
                  <li>We recommend checking for plagiarism before publishing generated content</li>
                </ul>
                <Text>
                  Our Service, including its technology, algorithms, and interface, remains our intellectual property.
                </Text>
              </section>

              <section>
                <Heading as="h2">6. Payment and Subscription</Heading>
                <Text>
                  Our Service operates on a subscription basis. By subscribing, you agree to:
                </Text>
                <ul>
                  <li>Pay all applicable fees as described in your chosen plan</li>
                  <li>Automatic renewal unless cancelled before the renewal date</li>
                  <li>No refunds for partial months or unused portions of your subscription</li>
                  <li>Price changes with 30 days advance notice</li>
                </ul>
              </section>

              <section>
                <Heading as="h2">7. Privacy and Data</Heading>
                <Text>
                  Your privacy is important to us. We collect and use your information as described in our Privacy Policy. By using our Service, you consent to the collection and use of your information in accordance with our Privacy Policy.
                </Text>
              </section>

              <section>
                <Heading as="h2">8. Service Availability</Heading>
                <Text>
                  While we strive to maintain high availability, we do not guarantee that our Service will be available 100% of the time. We may experience downtime for maintenance, updates, or technical issues. We are not liable for any losses resulting from Service unavailability.
                </Text>
              </section>

              <section>
                <Heading as="h2">9. Limitation of Liability</Heading>
                <Text>
                  To the maximum extent permitted by law, whoneedsawriter.com shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of our Service. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.
                </Text>
              </section>

              <section>
                <Heading as="h2">10. Content Disclaimers</Heading>
                <Text>
                  Generated content is provided &ldquo;as is&rdquo; without warranties. We do not guarantee:
                </Text>
                <ul>
                  <li>Accuracy, completeness, or quality of generated content</li>
                  <li>That generated content is plagiarism-free</li>
                  <li>That generated content meets your specific requirements</li>
                  <li>That generated content is suitable for your intended purpose</li>
                </ul>
                <Text>
                  You are solely responsible for reviewing, editing, and verifying all generated content before use.
                </Text>
              </section>

              <section>
                <Heading as="h2">11. Termination</Heading>
                <Text>
                  We may terminate or suspend your account immediately, without prior notice, if you breach these terms. You may terminate your account at any time through your account settings or by contacting us.
                </Text>
              </section>

              <section>
                <Heading as="h2">12. Changes to Terms</Heading>
                <Text>
                  We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through our Service. Continued use of our Service after changes constitutes acceptance of the new terms.
                </Text>
              </section>

              <section>
                <Heading as="h2">13. Governing Law</Heading>
                <Text>
                  These terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law principles.
                </Text>
              </section>

              <section>
                <Heading as="h2">14. Contact Information</Heading>
                <Text>
                  If you have any questions about these Terms and Conditions, please contact us at:
                </Text>
                <Text>
                  Email: support@whoneedsawriter.com
                  <br />
                  Website: whoneedsawriter.com
                </Text>
              </section>

              <Text fontSize="sm" color="gray.600" mt="8" fontStyle="italic">
                By using whoneedsawriter.com, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
              </Text>
            </Box>
          </Center>
        </Container>
      </Box>
    </div>
  );
}

export default PrivacyPage;
