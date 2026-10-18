import logo from "@/assets/ova-5050.png.asset.json";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from '@/components/ui/button';
export function LotteryModule(){return <div className="home-lottery"><div className="home-lottery-content"><img src={logo.url} alt="OVA 50/50" width={1024} height={284} className="lottery-logo mx-auto mb-3 w-44"/><p className="text-sm uppercase">Winner took home</p><p className="home-prize font-display">$14,835</p><Button asChild className="mt-4 min-w-40"><Link to="/fifty-fifty">Get your tickets<ArrowUpRight aria-hidden/></Link></Button><p className="mt-3 text-xs text-muted-foreground">18+ · Ontario only</p></div></div>;}
