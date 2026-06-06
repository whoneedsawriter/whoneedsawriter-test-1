import { AuthOptions, Session, User } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prismaClient } from "@/prisma/db";
import { createLoopsContact } from "@/libs/loops";
//import { addMailChimpListMember } from "@/libs/mailchimp";
import GoogleProvider from "next-auth/providers/google";
// import AppleProvider from "next-auth/providers/apple";
// import TwitterProvider from "next-auth/providers/twitter";
// import FacebookProvider from "next-auth/providers/facebook";
// import CredentialsProvider from "next-auth/providers/credentials"
import EmailProvider from "next-auth/providers/email";
// more providers at https://next-auth.js.org/providers
import { emailFrom } from "@/config";
import { sendTransactionalEmail } from "@/libs/loops"
import { applyDeviceFreeCreditPolicy } from "@/libs/device-free-credits";

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prismaClient),
  providers: [
    EmailProvider({
      async sendVerificationRequest({ identifier: email, url }) {
        await sendTransactionalEmail({
          transactionalId: "cmb2jkkpg0wdm150jeb3ght31", // the transactional id you created on Loops
          email,
          dataVariables: {
            url, // change it to the variable you set in the Loops transactional
          },
        });
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    /* AppleProvider({
        clientId: process.env.APPLE_ID || "",
        clientSecret: process.env.APPLE_SECRET || "",
      }), */
    /* TwitterProvider({
        clientId: process.env.TWITTER_CLIENT_ID || "",
        clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      }), */
    /* FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID || "",
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET || "",
      }), */
    /* EmailProvider({
        server: process.env.MAILPACE_EMAIL_SERVER || "",
        from: process.env.EMAIL_FROM || "",
        // maxAge: 24 * 60 * 60, // How long email links are valid for (default 24h)
      }), */
    /* CredentialsProvider({
        // The name to display on the sign in form (e.g. 'Sign in with...')
        name: "Credentials",
        // The credentials is used to generate a suitable form on the sign in page.
        // You can specify whatever fields you are expecting to be submitted.
        // e.g. domain, username, password, 2FA token, etc.
        // You can pass any HTML attribute to the <input> tag through the object.
        credentials: {
          username: { label: "Username", type: "text", placeholder: "jsmith" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, req) {
          // You need to provide your own logic here that takes the credentials
          // submitted and returns either a object representing a user or value
          // that is false/null if the credentials are invalid.
          // e.g. return { id: 1, name: 'J Smith', email: 'jsmith@example.com' }
          // You can also use the `req` object to obtain additional parameters
          // (i.e., the request IP address)
          const res = await fetch("/your/endpoint", {
            method: "POST",
            body: JSON.stringify(credentials),
            headers: { "Content-Type": "application/json" },
          });
          const user = await res.json();
  
          // If no error and we have user data, return it
          if (res.ok && user) {
            return user;
          }
          // Return null if user data could not be retrieved
          return null;
        },
      }), */
  ],
  callbacks: {
    session: async ({ session, user }: { session: Session; user: User }) => {
      if (session?.user) {
        session.user.id = user.id;
      }
      return Promise.resolve(session);
    },
  },
  events: {
    async signIn(event) {
      if (event.isNewUser && event.user.email) {
        
        // await addMailChimpListMember({
        //   email: event.user.email,
        //   firstName: event.user.name || "",
        //   lastName: "",
        //   tags: ["new-user"],
        // });
        
      
        await createLoopsContact({
          email: event.user.email,
          firstName: event.user.name || "",
          lastName: "",
          userGroup: "new-user",
        });
        
        /*
        // Uncomment this part if you are using workspaces
        await onAddInvitedUserToWorkspace(event.user.email);
        */
      }

      // Track first login for all users (new and existing)
      if (event.user.id) {
        const existingUser = await prismaClient.user.findUnique({
          where: { id: event.user.id },
          select: { firstLoginAt: true }
        });

        const now = new Date();
        const updateData: { firstLoginAt?: Date; lastLoginAt: Date } = {
          lastLoginAt: now
        };

        // Set firstLoginAt only if it's null (first time login)
        if (!existingUser?.firstLoginAt) {
          updateData.firstLoginAt = now;
        }

        await prismaClient.user.update({
          where: { id: event.user.id },
          data: updateData
        });
      }
    },
    async createUser({ user }) {
      await prismaClient.user.update({
        where: { id: user.id },
        data: { age: 35 },
      });

      try {
        const result = await applyDeviceFreeCreditPolicy(user.id);
        console.log(`Device free-credit policy result: ${result}`);
      } catch (error) {
        console.error("Failed to apply device free-credit policy:", error);
      }
    },

  },
};
