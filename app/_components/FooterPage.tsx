"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Facebook,
  GraduationCap,
  Linkedin,
  Mail,
  Video,
  Youtube,
} from "lucide-react";
import { ReactNode } from "react";

interface SocialIconProps {
  icon: ReactNode;
  href: string;
  label: string;
}

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-slate-200 bg-white text-slate-600">
      {/* Main footer */}
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-12 border-b border-slate-200 py-14 lg:grid-cols-[1.5fr_repeat(3,1fr)] lg:py-16">
          {/* Brand */}
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/15">
                <Brain className="h-5 w-5" />
              </span>

              <span className="flex flex-col leading-none">
                <span className="text-xl font-extrabold tracking-tight text-slate-950">
                  Justdy
                </span>
                <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Learn. Grow. Succeed.
                </span>
              </span>
            </Link>

            <p className="mt-5 text-sm leading-7 text-slate-500">
              An AI-powered educational ecosystem helping students, teachers,
              parents and schools learn, create and grow through intelligent
              tools, quality resources and live tutoring.
            </p>

            <div className="mt-6 flex items-center gap-2">
              <SocialIcon
                href="https://www.youtube.com/@JustdyLab/videos"
                label="YouTube"
                icon={<Youtube className="h-4 w-4" />}
              />

              <SocialIcon
                href="https://www.facebook.com/justdymath"
                label="Facebook"
                icon={<Facebook className="h-4 w-4" />}
              />

              <SocialIcon
                href="https://www.youtube.com/@justdymath01"
                label="YouTube"
                icon={<Youtube className="h-4 w-4" />}
              />

              <SocialIcon
                href="#"
                label="LinkedIn"
                icon={<Linkedin className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Platform */}
          <FooterColumn title="Platform">
            <FooterLink href="/dashboard" icon={<Brain />}>
              AI Workspace
            </FooterLink>

            <FooterLink href="/tutoring" icon={<Video />}>
              Live Tutoring
            </FooterLink>

            <FooterLink href="/products" icon={<BookOpen />}>
              Learning Resources
            </FooterLink>

            <FooterLink href="/dashboard" icon={<GraduationCap />}>
              Learning Tools
            </FooterLink>
          </FooterColumn>

          {/* For everyone */}
          <FooterColumn title="For Everyone">
            <FooterLink href="/dashboard">Students</FooterLink>
            <FooterLink href="/dashboard">Teachers</FooterLink>
            <FooterLink href="/tutoring">Parents</FooterLink>
            <FooterLink href="/contact">Schools</FooterLink>
          </FooterColumn>

          {/* Company */}
          <FooterColumn title="Company">
            <FooterLink href="/about">About Justdy</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/contact">Contact Us</FooterLink>
            <FooterLink href="/terms">Terms of Service</FooterLink>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
          </FooterColumn>
        </div>

        {/* Newsletter */}
        <div className="border-b border-slate-200 py-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <Mail className="h-4 w-4 text-blue-600" />
                Stay connected with Justdy
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Get useful learning ideas, new resources and platform updates.
              </p>
            </div>

            <form className="flex w-full max-w-md gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="email"
                  placeholder="Enter your email"
                  aria-label="Email address"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-blue-600"
              >
                Subscribe
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="bg-slate-50/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-6 text-xs sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div>
            <p className="font-semibold text-slate-700">
              © {currentYear} Justdy Learning
            </p>
            <p className="mt-1 text-slate-400">Learn. Grow. Succeed.</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link
              href="/terms"
              className="transition-colors hover:text-blue-600"
            >
              Terms
            </Link>

            <Link
              href="/privacy"
              className="transition-colors hover:text-blue-600"
            >
              Privacy
            </Link>

            <Link
              href="/contact"
              className="transition-colors hover:text-blue-600"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>

      <ul className="mt-5 space-y-3">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-blue-600"
      >
        {icon && (
          <span className="text-slate-400 transition-colors group-hover:text-blue-600">
            <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
          </span>
        )}

        <span>{children}</span>

        <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
      </Link>
    </li>
  );
}

const SocialIcon = ({ icon, href, label }: SocialIconProps) => {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md"
    >
      {icon}
    </Link>
  );
};

export default Footer;
