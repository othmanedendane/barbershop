import React, {useState} from 'react';

import Image from 'next/Image';

import Pet1Img from '../public/img/hair/1.jpg';
import Pet2Img from '../public/img/hair/2.webp';
import Pet3Img from '../public/img/hair/3.webp';
import Pet4Img from '../public/img/hair/4.webp';
import Pet5Img from '../public/img/hair/5.jpg';
import Pet6Img from '../public/img/hair/6.jpg';
import Pet7Img from '../public/img/hair/7.webp';
import Pet8Img from '../public/img/hair/8.jpg';
import Pet9Img from '../public/img/hair/9.jpg';
import Pet10Img from '../public/img/hair/10.jpg';
import Pet11Img from '../public/img/hair/11.jpg';
import Pet12Img from '../public/img/hair/12.jpg';
import Badge from '../public/img/pets/badge.svg';

const pets = [
  {
    id: 1,
    category: 'Short',
    name: 'Bald fade',
    image: Pet1Img,
  },
  {
    id: 2,
    category: 'Long',
    name: 'Box braids',
    image: Pet2Img,
  },
  {
    id: 3,
    category: 'Mid',
    name: 'Burst fade haircut',
    image: Pet3Img,
  },
  {
    id: 4,
    category: 'Short',
    name: 'Buzz cut',
    image: Pet4Img,
  },
  {
    id: 5,
    category: 'Short',
    name: 'Comb-over',
    image: Pet5Img,
  },
  {
    id: 6,
    category: 'Short',
    name: 'Disconnected undercut',
    image: Pet6Img,
  },
  {
    id: 7,
    category: 'Long',
    name: 'Dreadlocks',
    image: Pet7Img,
  },
  {
    id: 8,
    category: 'Short',
    name: 'Drop fade',
    image: Pet8Img,
  },
  {
    id: 9,
    category: 'Short',
    name: 'Edgar haircut',
    image: Pet9Img,
  },
  {
    id: 10,
    category: 'Short',
    name: 'French Crop',
    image: Pet10Img,
  },
  {
    id: 11,
    category: 'Mid',
    name: 'Frohawk',
    image: Pet11Img,
  },
  {
    id: 12,
    category: 'Short',
    name: 'High Fade',
    image: Pet12Img,
  }
]

const Pets = () => {
  const [petDeatils, setPetDetails] = useState(pets[11]);
  const [petIndex, setPetIndex] = useState(11);
  

  const getPetDetails= (id) => {
    const pet= pets.find((pet) => {
      return pet.id === id;
    });
    setPetDetails(pet)
  };

  return <section id="section1" className='bg-pets bg-center py-6 overflow-hidden'>
    <div className='flex flex-col lg:flex-row'>
      <div className='bg-blue-400 hidden xl:flex xl:w-[30%] xl:pl-[160px]'>
        <Image src={Badge} width={230} height={227} alt=''/>
        </div>
      <div className='bg-yellow flex-1 flex flex-col lg:flex-row'>
        <div className='lg:w-[30%] flex flex-col justify-center items-end pb-6 lg:py-2 mx-auto
        lg:mx-0'>
        <div className='text-center text-white'>
          <div className='text-[32px] capitalize'>
            {petDeatils.category}
          </div>
          <div className='uppercase text-[17px] mb-1'>
            -{petDeatils.name}-
            </div>
            <div className='w-[150px] h-[150px] mx-auto lg:mx-0 border-4 border-white square-full'>
            <Image style={{'height':"150px", 'width':"150px"}} src={petDeatils.image} alt='' />
            </div>
        </div>
        </div>
        <div className='relative lg:w-[60%]  flex-1 flex items-center'>
          <div className='flex flex-wrap gap-4 justify-center lg:justify-end '>
            {pets.map((pet, index)=> {
              return (
              <div onClick={() => 
                {
                  getPetDetails(pet.id);
                  setPetIndex(index);
                }
                } className='cursor-pointer relative'
              key={index}>
                <div className={` w-full h-full
                absolute ${petIndex === index ? 'border-2 border-white' : 'bg-black/40'}`}></div>
                <Image style={{'height':"100px", 'width':"100px"}} alt='' src={pet.image} draggable='flase' />
              </div>
              );
            })}
          </div>
          </div>
      </div>
    </div>
  </section>;
};

export default Pets;
