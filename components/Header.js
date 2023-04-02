import React from 'react';
import Image from 'next/image';
import Logo from '../public/img/header/log.png';

const Header = () => {
  return <header className='py-6 lg:absolute lg:w-full lg:left-0'>
    <div className='container mx-auto flex flex-col gap-y-6 lg:flex-row h-full justify-between items-center relative'>
      <a href="#">
        <Image className='w-20 h-17' src={Logo} />
        </a>
        <nav className='text-xl flex gap-x-4 lg:gap-x-12'> 
        <a href="#section2">Services</a>
        <a href="#section1">About</a>
        <a href="#section1">Blog</a>
        <a href="#section3">Contact</a>
         </nav>
         <button className='btn btn-primary '>Sign up</button>
    </div>
    </header>;
};

export default Header;
