/**
 * College utility functions for CampusLoop
 * Handles college CRUD, domain validation, and member management
 */

import { db } from '../firebaseConfig';
import {
  collection, query, where, getDocs, addDoc,
  doc, updateDoc, getDoc, serverTimestamp, orderBy, limit
} from 'firebase/firestore';

export interface College {
  id: string;
  name: string;
  shortName: string;
  domain: string;            // primary domain e.g. "rvce.edu.in"
  domains: string[];         // all valid domains for this college
  logo?: string;
  location: string;
  verified: boolean;
  memberCount: number;
  createdAt?: any;
}

// ─── Search colleges by name ────────────────────────────────────────────────
export async function searchColleges(term: string): Promise<College[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'colleges'), where('verified', '==', true), orderBy('memberCount', 'desc'), limit(50))
    );
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as College));
    if (!term.trim()) return all;
    const lower = term.toLowerCase();
    return all.filter(
      c => c.name.toLowerCase().includes(lower) ||
           c.shortName.toLowerCase().includes(lower) ||
           c.location.toLowerCase().includes(lower)
    );
  } catch {
    return [];
  }
}

// ─── Get college by ID ───────────────────────────────────────────────────────
export async function getCollegeById(id: string): Promise<College | null> {
  try {
    const snap = await getDoc(doc(db, 'colleges', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as College;
  } catch {
    return null;
  }
}

// ─── Validate that an email belongs to a college domain ─────────────────────
export function validateCollegeEmail(email: string, college: College): boolean {
  const emailDomain = email.toLowerCase().split('@')[1];
  if (!emailDomain) return false;
  const validDomains = college.domains?.length ? college.domains : [college.domain];
  return validDomains.some(d => emailDomain === d.toLowerCase());
}

// ─── Submit a "request my college" form ─────────────────────────────────────
export async function requestCollege(data: {
  name: string;
  domain: string;
  location: string;
  requestedBy: string;
  requestedByEmail: string;
}): Promise<void> {
  await addDoc(collection(db, 'college_requests'), {
    ...data,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

// ─── Admin: create a new college ────────────────────────────────────────────
export async function createCollege(data: Omit<College, 'id' | 'createdAt' | 'memberCount'>): Promise<string> {
  const ref = await addDoc(collection(db, 'colleges'), {
    ...data,
    memberCount: 0,
    verified: data.verified ?? true,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Increment college member count ─────────────────────────────────────────
export async function incrementCollegeMemberCount(collegeId: string, delta: 1 | -1 = 1): Promise<void> {
  try {
    const ref = doc(db, 'colleges', collegeId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const current = snap.data().memberCount || 0;
      await updateDoc(ref, { memberCount: Math.max(0, current + delta) });
    }
  } catch {}
}

// ─── Seed initial colleges into Firestore (run once) ────────────────────────
export const SEED_COLLEGES: Omit<College, 'id' | 'createdAt' | 'memberCount'>[] = [
  {
    name: 'RV College of Engineering',
    shortName: 'RVCE',
    domain: 'rvce.edu.in',
    domains: ['rvce.edu.in', 'student.rvce.edu.in'],
    location: 'Bengaluru, Karnataka',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Bombay',
    shortName: 'IIT Bombay',
    domain: 'iitb.ac.in',
    domains: ['iitb.ac.in', 'student.iitb.ac.in'],
    location: 'Mumbai, Maharashtra',
    verified: true,
  },
  {
    name: 'Indian Institute of Technology Delhi',
    shortName: 'IIT Delhi',
    domain: 'iitd.ac.in',
    domains: ['iitd.ac.in', 'student.iitd.ac.in'],
    location: 'New Delhi',
    verified: true,
  },
  {
    name: 'National Institute of Technology Karnataka',
    shortName: 'NITK',
    domain: 'nitk.edu.in',
    domains: ['nitk.edu.in', 'student.nitk.edu.in'],
    location: 'Surathkal, Karnataka',
    verified: true,
  },
  {
    name: 'PES University',
    shortName: 'PESU',
    domain: 'pes.edu',
    domains: ['pes.edu', 'student.pes.edu', 'pesu.edu'],
    location: 'Bengaluru, Karnataka',
    verified: true,
  },
  {
    name: 'Manipal Institute of Technology',
    shortName: 'MIT Manipal',
    domain: 'manipal.edu',
    domains: ['manipal.edu', 'student.manipal.edu'],
    location: 'Manipal, Karnataka',
    verified: true,
  },
  {
    name: 'Vellore Institute of Technology',
    shortName: 'VIT',
    domain: 'vit.ac.in',
    domains: ['vit.ac.in', 'student.vit.ac.in'],
    location: 'Vellore, Tamil Nadu',
    verified: true,
  },
  {
    name: 'Christ University',
    shortName: 'CHRIST',
    domain: 'christuniversity.in',
    domains: ['christuniversity.in', 'student.christuniversity.in'],
    location: 'Bengaluru, Karnataka',
    verified: true,
  },
  {
    name: 'MS Ramaiah University of Applied Sciences',
    shortName: 'MSRUAS',
    domain: 'msruas.ac.in',
    domains: ['msruas.ac.in', 'student.msruas.ac.in'],
    location: 'Bengaluru, Karnataka',
    verified: true,
  },
  {
    name: 'BMS College of Engineering',
    shortName: 'BMSCE',
    domain: 'bmsce.ac.in',
    domains: ['bmsce.ac.in', 'student.bmsce.ac.in'],
    location: 'Bengaluru, Karnataka',
    verified: true,
  },
];
